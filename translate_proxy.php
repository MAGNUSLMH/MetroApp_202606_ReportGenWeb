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

// NOTE: Check your Space's "Use via API" button at the bottom of the page.
// If it is a newer Gradio space, the URL is usually /run/translate_and_standardize
// If it is an older space, it remains /api/predict/translate_and_standardize
$spaceEndpoint = 'https://magnuslmh-t5-finet-01.hf.space/run/translate_and_standardize';

// Gradio API expects inputs inside a "data" array
$payload = json_encode([
    'data' => [$text],
]);

$ch = curl_init($spaceEndpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

$responseBody = curl_exec($ch);
$curlErrNo = curl_errno($ch);
$curlErrMsg = curl_error($ch);
$httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($curlErrNo !== 0) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Upstream request failed',
        'details' => $curlErrMsg,
    ]);
    exit;
}

if ($httpCode < 200 || $httpCode >= 300) {
    http_response_code($httpCode);
    echo json_encode([
        'error' => 'Upstream HTTP error',
        'status' => $httpCode,
        'body' => $responseBody,
    ]);
    exit;
}

// If the Space already returns Gradio-style JSON ({ data: [...] }), just forward it.
// The frontend will pick out data[0].
echo $responseBody;
exit;
