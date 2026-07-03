<?php
// gpt_proxy.php
// Proxy endpoint for Azure OpenAI GPT used by the web UI.
// Accepts the original Chinese text from the frontend (via JSON POST / GET / POST form)
// and returns a JSON payload with a translated English string in MTR-style language.

// Do not leak PHP warnings/notices into the JSON response.
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin', '*');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// 1. Read input text from JSON body or GET/POST parameters.
$rawBody = file_get_contents('php://input');
$data = json_decode($rawBody, true);

$text = null;

if (is_array($data) && isset($data['text'])) {
    $text = trim((string)$data['text']);
} elseif (isset($_POST['text'])) {
    $text = trim((string)$_POST['text']);
} elseif (isset($_GET['text'])) {
    $text = trim((string)$_GET['text']);
}

if ($text === null || $text === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Empty text']);
    exit;
}

// 2. Set your API Key and Endpoint
// (Replace with your actual CUHK Azure API key)
$azure_api_key = "your_actual_cuhk_api_key_here";
$url = "https://cuhk-apip.azure-api.net/openai-eus2/openai/v1/chat/completions";

// 3. Build the Azure OpenAI Chat Completions request payload.
// We instruct GPT to translate the Traditional Chinese incident text into
// concise, professional English in the style used by MTR incident reports.
$systemPrompt = "You are an MTR incident report English translation assistant. "
    . "Translate the following Traditional Chinese text into clear, concise, "
    . "professional English suitable for MTR incident reporting. Preserve "
    . "technical terms, times, and structure. Do not add explanations or commentary.";

$payload = [
    "model" => "gpt-4o-mini", // fast, cost-effective model; UI label calls this GPT-5.1 (MTR語言)
    "messages" => [
        ["role" => "system", "content" => $systemPrompt],
        ["role" => "user", "content" => $text],
    ],
    "temperature" => 0.2,
];

$jsonPayload = json_encode($payload, JSON_UNESCAPED_UNICODE);

// 4. Initialize cURL and send request to Azure OpenAI.
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonPayload);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Cache-Control: no-cache",
    "api-key: " . $azure_api_key,
]);

$responseBody = curl_exec($ch);
$curlErrNo = curl_errno($ch);
$curlErrMsg = curl_error($ch);
$httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// 5. Handle network / HTTP errors.
if ($curlErrNo !== 0) {
    http_response_code(502);
    echo json_encode([
        "error" => "Upstream request failed",
        "details" => $curlErrMsg,
    ]);
    exit;
}

if ($httpCode < 200 || $httpCode >= 300) {
    http_response_code($httpCode);

    $decodedError = json_decode($responseBody, true);
    if (is_array($decodedError) && isset($decodedError['error'])) {
        echo json_encode([
            "error" => $decodedError['error'],
        ]);
    } else {
        echo json_encode([
            "error"  => "Azure OpenAI HTTP error",
            "status" => $httpCode,
        ]);
    }
    exit;
}

// 6. Parse Azure OpenAI response and return a simple JSON structure.
$decoded = json_decode($responseBody, true);

if (
    !is_array($decoded) ||
    !isset($decoded['choices']) ||
    !is_array($decoded['choices']) ||
    count($decoded['choices']) === 0 ||
    !isset($decoded['choices'][0]['message']['content'])
) {
    http_response_code(502);
    echo json_encode([
        "error" => "Invalid response format from Azure OpenAI",
    ]);
    exit;
}

$aiReply = (string)$decoded['choices'][0]['message']['content'];

echo json_encode([
    "original"   => $text,
    "translated" => $aiReply,
], JSON_UNESCAPED_UNICODE);
exit;