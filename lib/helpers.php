<?php

declare(strict_types=1);

/** Simple per-IP rate limit for lightweight JSON proxies. */
function pinchard_rate_limit(string $bucket, int $maxRequests, int $windowSeconds = 3600): void
{
	$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
	$file = sys_get_temp_dir() . '/pinchard_rl_' . $bucket . '_' . md5($ip) . '.json';
	$now = time();
	$data = ['count' => 0, 'start' => $now];

	if (is_readable($file)) {
		$decoded = json_decode((string) file_get_contents($file), true);
		if (is_array($decoded) && isset($decoded['count'], $decoded['start'])) {
			$data = $decoded;
		}
	}

	if ($now - (int) $data['start'] >= $windowSeconds) {
		$data = ['count' => 0, 'start' => $now];
	}

	$data['count'] = (int) $data['count'] + 1;
	file_put_contents($file, json_encode($data), LOCK_EX);

	if ($data['count'] > $maxRequests) {
		http_response_code(429);
		header('Content-Type: application/json; charset=utf-8');
		echo json_encode(['error' => 'Rate limit exceeded. Try again later.']);
		exit;
	}
}
