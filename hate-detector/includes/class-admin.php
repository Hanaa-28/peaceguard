<?php
defined('ABSPATH') || exit;

/**
 * HSD_Admin
 * Ajoute une page de configuration dans Réglages → Hate Detector.
 */
class HSD_Admin {

    public function __construct() {
        add_action('admin_menu',    [$this, 'add_menu']);
        add_action('admin_init',    [$this, 'register_settings']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
    }

    public function add_menu(): void {
        add_options_page(
            'Hate Speech Detector',
            'Hate Detector',
            'manage_options',
            'hate-detector',
            [$this, 'render_settings_page']
        );
    }

    public function register_settings(): void {
        $fields = ['hsd_api_url', 'hsd_api_key', 'hsd_threshold', 'hsd_action', 'hsd_timeout'];
        foreach ($fields as $field) {
            register_setting('hsd_group', $field, ['sanitize_callback' => 'sanitize_text_field']);
        }
    }

    public function enqueue_assets(string $hook): void {
        if ($hook !== 'settings_page_hate-detector') return;
        wp_enqueue_style('hsd-admin', plugin_dir_url(dirname(__FILE__)) . 'assets/admin.css', [], '1.0.0');
    }

    public function render_settings_page(): void {
        if (!current_user_can('manage_options')) return;

        // Test de connexion si demandé
        $test_result = '';
        if (isset($_POST['hsd_test_connection']) && check_admin_referer('hsd_test_nonce')) {
            $test_result = $this->test_connection();
        }

        $api_url   = get_option('hsd_api_url', '');
        $threshold = get_option('hsd_threshold', '0.7');
        $action    = get_option('hsd_action', 'spam');
        $timeout   = get_option('hsd_timeout', '10');

        // Statistiques rapides
        $logs      = HSD_Logger::get_recent(5);
        ?>
        <div class="wrap hsd-wrap">
            <h1>🛡 Hate Speech Detector</h1>

            <?php if ($test_result): ?>
                <div class="notice notice-<?= $test_result['ok'] ? 'success' : 'error'; ?> is-dismissible">
                    <p><?= esc_html($test_result['message']); ?></p>
                </div>
            <?php endif; ?>

            <!-- Paramètres -->
            <div class="hsd-card">
                <h2>Paramètres de l'API</h2>
                <form method="post" action="options.php">
                    <?php settings_fields('hsd_group'); ?>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><label for="hsd_api_url">URL de votre API</label></th>
                            <td>
                                <input type="url" id="hsd_api_url" name="hsd_api_url"
                                       value="<?= esc_attr($api_url); ?>"
                                       class="regular-text"
                                       placeholder="https://votre-api.com"/>
                                <p class="description">L'endpoint <code>/analyze</code> sera appelé automatiquement.</p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><label for="hsd_api_key">Clé API (X-API-Key)</label></th>
                            <td>
                                <input type="password" id="hsd_api_key" name="hsd_api_key"
                                       value="<?= esc_attr(get_option('hsd_api_key', '')); ?>"
                                       class="regular-text"
                                       autocomplete="new-password"/>
                                <p class="description">Envoyée dans le header <code>X-API-Key</code>.</p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><label for="hsd_threshold">Seuil de blocage</label></th>
                            <td>
                                <input type="number" id="hsd_threshold" name="hsd_threshold"
                                       value="<?= esc_attr($threshold); ?>"
                                       min="0" max="1" step="0.05" class="small-text"/>
                                <span> (entre 0 et 1 — recommandé : 0.7)</span>
                                <p class="description">Un commentaire avec un score ≥ à ce seuil sera bloqué.</p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><label for="hsd_action">Action en cas de détection</label></th>
                            <td>
                                <select id="hsd_action" name="hsd_action">
                                    <option value="spam"    <?= selected($action, 'spam',    false); ?>>Marquer comme spam (supprimé)</option>
                                    <option value="pending" <?= selected($action, 'pending', false); ?>>Mettre en attente (modération manuelle)</option>
                                </select>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><label for="hsd_timeout">Timeout API (secondes)</label></th>
                            <td>
                                <input type="number" id="hsd_timeout" name="hsd_timeout"
                                       value="<?= esc_attr($timeout); ?>"
                                       min="3" max="30" class="small-text"/>
                                <p class="description">Si l'API ne répond pas dans ce délai, le commentaire passe (fail open).</p>
                            </td>
                        </tr>
                    </table>
                    <?php submit_button('Enregistrer les paramètres'); ?>
                </form>
            </div>

            <!-- Test de connexion -->
            <div class="hsd-card">
                <h2>Tester la connexion</h2>
                <form method="post">
                    <?php wp_nonce_field('hsd_test_nonce'); ?>
                    <input type="hidden" name="hsd_test_connection" value="1"/>
                    <input type="submit" class="button button-secondary" value="🔌 Tester la connexion API"/>
                </form>
            </div>

            <!-- Logs récents -->
            <div class="hsd-card">
                <h2>Logs récents</h2>
                <?php if (empty($logs)): ?>
                    <p>Aucun log pour l'instant.</p>
                <?php else: ?>
                    <table class="widefat striped">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Niveau</th>
                                <th>Message</th>
                            </tr>
                        </thead>
                        <tbody>
                        <?php foreach ($logs as $log): ?>
                            <tr>
                                <td><?= esc_html($log->created_at); ?></td>
                                <td><span class="hsd-badge hsd-badge-<?= esc_attr($log->level); ?>"><?= esc_html($log->level); ?></span></td>
                                <td><?= esc_html($log->message); ?></td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                    <p><a href="<?= admin_url('options-general.php?page=hate-detector&hsd_clear_logs=1'); ?>" class="button">Effacer les logs</a></p>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }

    private function test_connection(): array {
        $api_url = get_option('hsd_api_url', '');
        $api_key = get_option('hsd_api_key', '');

        if (empty($api_url)) {
            return ['ok' => false, 'message' => 'URL de l\'API non configurée.'];
        }

        $analyzer = new HSD_Analyzer($api_url, $api_key);
        $result   = $analyzer->analyze('Ceci est un texte de test.');

        if (is_wp_error($result)) {
            return ['ok' => false, 'message' => 'Erreur : ' . $result->get_error_message()];
        }

        return [
            'ok'      => true,
            'message' => sprintf('Connexion réussie ! Score retourné : %.2f | Label : %s', $result['score'], $result['label']),
        ];
    }
}

new HSD_Admin();

// Nettoyage des logs si demandé
add_action('admin_init', function() {
    if (isset($_GET['hsd_clear_logs']) && current_user_can('manage_options')) {
        HSD_Logger::clear();
        wp_redirect(admin_url('options-general.php?page=hate-detector'));
        exit;
    }
});
