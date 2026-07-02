<?php
// Simple PHP proxy to call the Hugging Face backend from your own server.
// This avoids browser CORS issues by doing the remote call server-side.

// Ensure PHP notices/warnings are not dumped as HTML into the response
// (which would break JSON parsing on the frontend).
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody, true);

if (!is_array($data) || !isset($data['text'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing "text" field in request body']);
    exit;
}

$text = trim((string)$data['text']);

if ($text === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty text']);
    exit;
}

// NOTE: Official Gradio Python client docs for this Space (sample02.txt) show:
//   client = Client("magnuslmh/marianMT_01")
//   result = client.predict(text="Hello!!", api_name="/core_paraphrase_engine")
// Modern Spaces expose a queue-style HTTP API under /gradio_api/call/<api_name>.
// Here we mirror that flow in PHP:
//   1) POST the input text to the queue endpoint to get an event_id
//   2) GET the Server-Sent Events (SSE) stream for that event_id
//   3) Parse the "event: complete" payload to obtain the final output
//   4) Return a simple JSON object { data: ["<paraphrased text>"] }

// Base URL for the marianMT_01 Space; adjust if Hugging Face changes the slug.
$baseUrl = 'https://magnuslmh-marianmt-01.hf.space';
// API name without leading slash, matching api_name="/core_paraphrase_engine".
$apiName = 'core_paraphrase_engine';

$queueUrl  = $baseUrl . '/gradio_api/call/' . $apiName;
$payload   = json_encode([
    'data' => [$text],
]);

// Step 1: submit to Gradio queue
$ch = curl_init($queueUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

$queueBody = curl_exec($ch);
$queueErrNo = curl_errno($ch);
$queueErrMsg = curl_error($ch);
$queueHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($queueErrNo !== 0) {
    http_response_code(502);
    echo json_encode([
        'error'   => 'Upstream queue request failed',
        'details' => $queueErrMsg,
    ]);
    exit;
}

if ($queueHttpCode < 200 || $queueHttpCode >= 300) {
    http_response_code($queueHttpCode);
    echo json_encode([
        'error'  => 'Upstream HTTP error (queue)',
        'status' => $queueHttpCode,
        'body'   => $queueBody,
    ]);
    exit;
}

$initData = json_decode($queueBody, true);
if (!is_array($initData) || !isset($initData['event_id'])) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Invalid queue response: missing event_id',
        'body'  => $queueBody,
    ]);
    exit;
}

$eventId = (string)$initData['event_id'];
if ($eventId === '') {
    http_response_code(502);
    echo json_encode([
        'error' => 'Empty event_id from queue response',
    ]);
    exit;
}

// Step 2: fetch SSE stream for this event
$streamUrl = $baseUrl . '/gradio_api/call/' . $apiName . '/' . urlencode($eventId);

$ch = curl_init($streamUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPGET, true);

$streamText = curl_exec($ch);
$streamErrNo = curl_errno($ch);
$streamErrMsg = curl_error($ch);
$streamHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($streamErrNo !== 0) {
    http_response_code(502);
    echo json_encode([
        'error'   => 'Upstream stream request failed',
        'details' => $streamErrMsg,
    ]);
    exit;
}

if ($streamHttpCode < 200 || $streamHttpCode >= 300) {
    http_response_code($streamHttpCode);
    echo json_encode([
        'error'  => 'Upstream HTTP error (stream)',
        'status' => $streamHttpCode,
        'body'   => $streamText,
    ]);
    exit;
}

// Step 3: parse SSE for "event: complete" JSON line
$completeMarker = "event: complete\ndata: ";
$startPos = strpos($streamText, $completeMarker);
$jsonLine = '';

if ($startPos !== false) {
    $after = substr($streamText, $startPos + strlen($completeMarker));
    // Take up to the first newline (\n or \r)
    $jsonLine = strtok($after, "\r\n");
} else {
    $altMarker = "event: complete\r\ndata: ";
    $startPos = strpos($streamText, $altMarker);
    if ($startPos === false) {
        http_response_code(502);
        echo json_encode([
            'error' => 'Could not find completion marker in SSE stream',
            'body'  => $streamText,
        ]);
        exit;
    }
    $after = substr($streamText, $startPos + strlen($altMarker));
    $jsonLine = strtok($after, "\r\n");
}

if ($jsonLine === '' || $jsonLine === false) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Empty completion payload in SSE stream',
        'body'  => $streamText,
    ]);
    exit;
}

$resultData = json_decode($jsonLine, true);
if (!is_array($resultData) || count($resultData) === 0) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Unexpected data format returned by SSE stream',
        'body'  => $jsonLine,
    ]);
    exit;
}

$finalTextRaw = $resultData[0];
$finalText = is_string($finalTextRaw) ? $finalTextRaw : json_encode($finalTextRaw);

// Step 4: return a simple Gradio-style object so script.js can keep
// expecting payload.data[0]
http_response_code(200);
echo json_encode([
    'data' => [$finalText],
]);
exit;
