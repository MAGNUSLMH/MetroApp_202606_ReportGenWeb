<?php
// Simple PHP proxy to call the external translation API from your own server.
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

// External translation API endpoint (PythonAnywhere)
$apiEndpoint = 'https://magnuslmh.pythonanywhere.com/translator/translate';

// API expects JSON: { "text": "<Traditional Chinese text>" }
$payload = json_encode([
    'text' => $text,
], JSON_UNESCAPED_UNICODE);

$ch = curl_init($apiEndpoint);
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

    $decodedError = json_decode($responseBody, true);
    if (is_array($decodedError) && isset($decodedError['error'])) {
        echo json_encode([
            'error' => $decodedError['error'],
        ]);
    } else {
        echo json_encode([
            'error'  => 'Upstream HTTP error',
            'status' => $httpCode,
        ]);
    }
    exit;
}

// Successful response: expect JSON with "original" and "translated" keys
$decoded = json_decode($responseBody, true);
if (!is_array($decoded) || !isset($decoded['translated'])) {
    http_response_code(502);
    echo json_encode([
        'error' => 'Invalid response format from translator API',
    ]);
    exit;
}

echo json_encode([
    'original'   => $decoded['original'] ?? $text,
    'translated' => $decoded['translated'],
]);
exit;
