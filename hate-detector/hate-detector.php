<?php
/**
 * Plugin Name:  Hate Speech Detector
 * Plugin URI:   https://yourwebsite.com
 * Description:  Analyse les commentaires via votre API LLM, propose une reformulation si nécessaire.
 * Version:      2.0.0
 * Author:       Votre Nom
 * License:      GPL-2.0+
 * Text Domain:  hate-detector
 */

defined('ABSPATH') || exit;

// Chargement des classes
require_once plugin_dir_path(__FILE__) . 'includes/class-analyzer.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-admin.php';
require_once plugin_dir_path(__FILE__) . 'includes/class-logger.php';

// ────────────────────────────────────────────────────────────────────────────
// 1. FRONTEND : injecter JS + CSS sur les pages avec un formulaire de commentaire
// ────────────────────────────────────────────────────────────────────────────

add_action('wp_enqueue_scripts', 'hsd_enqueue_frontend_assets');

function hsd_enqueue_frontend_assets(): void {
    if (!is_singular() || !comments_open()) return;

    $plugin_url = plugin_dir_url(__FILE__);
    $version    = '2.0.0';

    wp_enqueue_style('hsd-frontend', $plugin_url . 'assets/frontend.css', [], $version);

    wp_enqueue_script('hsd-frontend', $plugin_url . 'assets/frontend.js', [], $version, true);

    wp_localize_script('hsd-frontend', 'hsdData', [
        'ajaxUrl'   => admin_url('admin-ajax.php'),
        'nonce'     => wp_create_nonce('hsd_analyze_nonce'),
        'threshold' => floatval(get_option('hsd_threshold', 0.7)),
    ]);
}

// ────────────────────────────────────────────────────────────────────────────
// 2. AJAX : endpoint appelé par le JS pour analyser + obtenir la reformulation
// ────────────────────────────────────────────────────────────────────────────

add_action('wp_ajax_hsd_analyze',        'hsd_ajax_analyze');
add_action('wp_ajax_nopriv_hsd_analyze', 'hsd_ajax_analyze');

function hsd_ajax_analyze(): void {
    if (!check_ajax_referer('hsd_analyze_nonce', 'nonce', false)) {
        wp_send_json_error('Requête invalide.', 403);
    }

    $text    = isset($_POST['text']) ? sanitize_textarea_field(wp_unslash($_POST['text'])) : '';
    $api_url = get_option('hsd_api_url', 'http://localhost:5000');
    $api_key = get_option('hsd_api_key', 'Len@1oan');

    if (empty($text) || empty($api_url)) {
        wp_send_json_error('Paramètres manquants.');
    }

    $analyzer = new HSD_Analyzer($api_url, $api_key);
    $result   = $analyzer->analyze($text);

    if (is_wp_error($result)) {
        HSD_Logger::log('Erreur AJAX : ' . $result->get_error_message(), 'error');
        wp_send_json_error($result->get_error_message());
    }

    HSD_Logger::log(sprintf('Analyse AJAX | Score: %.2f | Label: %s', $result['score'], $result['label']));

    wp_send_json_success($result);
}

// ────────────────────────────────────────────────────────────────────────────
// 3. BACKEND : validation côté serveur à la soumission finale
// ────────────────────────────────────────────────────────────────────────────

add_filter('pre_comment_approved', 'hsd_server_side_check', 10, 2);

function hsd_server_side_check($approved, $commentdata) {
    if (!empty($commentdata['comment_type']) && $commentdata['comment_type'] !== 'comment') {
        return $approved;
    }

    $text      = sanitize_textarea_field($commentdata['comment_content']);
    $api_url   = get_option('hsd_api_url', '');
    $api_key   = get_option('hsd_api_key', '');
    $threshold = floatval(get_option('hsd_threshold', 0.7));
    $action    = get_option('hsd_action', 'pending');

    if (empty($api_url) || empty($text)) return $approved;

    $analyzer = new HSD_Analyzer($api_url, $api_key);
    $result   = $analyzer->analyze($text);

    if (is_wp_error($result)) {
        HSD_Logger::log('Vérification serveur échouée : ' . $result->get_error_message(), 'error');
        return $approved; // fail open
    }

    $score = floatval($result['score']);

    global $hsd_pending_meta;
    $hsd_pending_meta = [
        'score'    => $score,
        'label'    => $result['label'],
        'keywords' => $result['keywords'],
    ];
    add_action('comment_post', 'hsd_save_comment_meta', 10, 1);

    if ($score >= $threshold) {
        HSD_Logger::log(sprintf('Commentaire bloqué côté serveur | Score: %.2f', $score), 'warning');
        return $action; // 'pending' par défaut
    }

    return $approved;
}

// ────────────────────────────────────────────────────────────────────────────
// 4. MÉTADONNÉES
// ────────────────────────────────────────────────────────────────────────────

function hsd_save_comment_meta(int $comment_id): void {
    global $hsd_pending_meta;
    if (!empty($hsd_pending_meta)) {
        update_comment_meta($comment_id, 'hsd_score',    $hsd_pending_meta['score']);
        update_comment_meta($comment_id, 'hsd_label',    $hsd_pending_meta['label']);
        update_comment_meta($comment_id, 'hsd_keywords', $hsd_pending_meta['keywords']);
        $hsd_pending_meta = null;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// 5. ADMIN : afficher le score dans la liste des commentaires
// ────────────────────────────────────────────────────────────────────────────

add_filter('comment_row_actions', 'hsd_add_score_to_comment_row', 10, 2);

function hsd_add_score_to_comment_row(array $actions, $comment): array {
    $score = get_comment_meta($comment->comment_ID, 'hsd_score', true);
    $label = get_comment_meta($comment->comment_ID, 'hsd_label', true);

    if ($score !== '') {
        $pct   = round($score * 100);
        $color = $score >= 0.7 ? '#c0392b' : ($score >= 0.4 ? '#e67e22' : '#27ae60');
        $actions['hsd_score'] = sprintf(
            '<span style="color:%s;font-weight:600;">🛡 %d%% — %s</span>',
            $color, $pct, esc_html($label)
        );
    }

    return $actions;
}

// ────────────────────────────────────────────────────────────────────────────
// 6. ACTIVATION / DÉSACTIVATION
// ────────────────────────────────────────────────────────────────────────────

register_activation_hook(__FILE__, 'hsd_activate');

function hsd_activate(): void {
    HSD_Logger::create_table();
    add_option('hsd_threshold',   '0.7');
    add_option('hsd_action',      'pending');
    add_option('hsd_timeout',     '10');
    add_option('hsd_enable_logs', '1');
}

register_deactivation_hook(__FILE__, 'hsd_deactivate');
function hsd_deactivate(): void {}
