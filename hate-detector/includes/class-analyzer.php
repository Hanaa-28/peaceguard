<?php
defined('ABSPATH') || exit;

/**
 * HSD_Analyzer
 *
 * Envoie le texte à votre API REST et retourne :
 *   - score    : float 0–1
 *   - label    : string ('hateful', 'neutral', etc.)
 *   - keywords : string[]
 *   - rewrite  : string  (reformulation neutre proposée par le LLM)
 */
class HSD_Analyzer {

    private string $api_url;
    private string $api_key;
    private int    $timeout;

    public function __construct(string $api_url, string $api_key) {
        $this->api_url = rtrim($api_url, '/');
        $this->api_key = $api_key;
        $this->timeout = intval(get_option('hsd_timeout', 10));
    }

    /**
     * Analyse un texte via POST /analyze.
     *
     * Votre API doit retourner un JSON de la forme :
     * {
     *   "toxic": true,
     *   "toxicity_score": 85,
     *   "risk_level": "élevé",
     *   "category": "insulte",
     *   "emotions": ["colère"],
     *   "keywords": ["mot1", "mot2"],
     *   "explanation": "Explication de l'analyse",
     *   "peaceful_rewrite": "Version reformulée et neutre du commentaire"
     * }
     *
     * Le champ "peaceful_rewrite" n'est retourné par votre API que si toxicity_score >= seuil.
     * S'il est absent, le plugin l'ignore gracieusement.
     *
     * @param  string         $text
     * @return array|WP_Error
     */
    public function analyze(string $text) {
        $endpoint = $this->api_url . '/analyze';

        $response = wp_remote_post($endpoint, [
            'timeout'     => $this->timeout,
            'redirection' => 3,
            'headers'     => [
                'Content-Type' => 'application/json',
                'Accept'       => 'application/json',
                'X-API-Key'    => $this->api_key,
            ],
            'body' => json_encode(['text' => $text]),
        ]);

        if (is_wp_error($response)) {
            return $response;
        }

        $http_code = wp_remote_retrieve_response_code($response);
        $raw_body = wp_remote_retrieve_body($response);
        $body = json_decode($raw_body, true);

        if (!is_array($body)) {
            HSD_Logger::log('Analyse API invalide : réponse non JSON - ' . substr($raw_body, 0, 512), 'error');
            return new WP_Error('hsd_invalid_response', 'Réponse API invalide : JSON attendu.');
        }

        if ($http_code !== 200) {
            HSD_Logger::log(sprintf('Analyse API HTTP %d : %s', $http_code, substr($raw_body, 0, 512)), 'error');
            $msg = $body['detail'] ?? $body['message'] ?? "HTTP $http_code";
            return new WP_Error('hsd_api_error', $msg);
        }

        $score = null;

        if (isset($body['score'])) {
            $score = floatval(str_replace(',', '.', $body['score']));
        } elseif (isset($body['toxicity_score'])) {
            $score = floatval(str_replace(',', '.', $body['toxicity_score']));
        } elseif (isset($body['toxicity'])) {
            $score = floatval(str_replace(',', '.', $body['toxicity']));
        } elseif (isset($body['toxic'])) {
            $score = $body['toxic'] ? 1.0 : 0.0;
        }

        if ($score === null) {
            HSD_Logger::log('Analyse API invalide : score manquant - ' . substr($raw_body, 0, 512), 'error');
            return new WP_Error('hsd_invalid_response', 'Champ "score" ou "toxicity_score" manquant dans la réponse API.');
        }

        if ($score > 1.0) {
            $score = $score / 100.0;
        }
        if ($score < 0.0) {
            $score = 0.0;
        } elseif ($score > 1.0) {
            $score = 1.0;
        }

        return [
            'score'    => $score,
            'label'    => sanitize_text_field($body['label'] ?? $body['category'] ?? 'unknown'),
            'keywords' => array_map('sanitize_text_field', $body['keywords'] ?? []),
            'rewrite'  => sanitize_textarea_field($body['peaceful_rewrite'] ?? ''),
        ];
    }
}
