<?php
defined('ABSPATH') || exit;

/**
 * HSD_Logger
 * Stocke les logs d'analyse dans une table dédiée wp_hsd_logs.
 */
class HSD_Logger {

    private static function table_name(): string {
        global $wpdb;
        return $wpdb->prefix . 'hsd_logs';
    }

    /**
     * Crée la table de logs à l'activation du plugin.
     */
    public static function create_table(): void {
        global $wpdb;
        $table   = self::table_name();
        $charset = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS $table (
            id         BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
            level      VARCHAR(10)         NOT NULL DEFAULT 'info',
            message    TEXT                NOT NULL,
            created_at DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id)
        ) $charset;";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta($sql);
    }

    /**
     * Écrit un log.
     *
     * @param string $message
     * @param string $level   'info' | 'warning' | 'error'
     */
    public static function log(string $message, string $level = 'info'): void {
        global $wpdb;

        // Ne loguer que si l'option est activée (pour éviter de remplir la base)
        if (!get_option('hsd_enable_logs', true)) return;

        $wpdb->insert(self::table_name(), [
            'level'   => $level,
            'message' => $message,
        ]);

        // Garder seulement les 500 derniers logs
        $count = (int) $wpdb->get_var("SELECT COUNT(*) FROM " . self::table_name());
        if ($count > 500) {
            $wpdb->query("DELETE FROM " . self::table_name() . " ORDER BY id ASC LIMIT " . ($count - 500));
        }
    }

    /**
     * Récupère les N derniers logs.
     */
    public static function get_recent(int $limit = 20): array {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM " . self::table_name() . " ORDER BY id DESC LIMIT %d",
                $limit
            )
        );
    }

    /**
     * Efface tous les logs.
     */
    public static function clear(): void {
        global $wpdb;
        $wpdb->query("TRUNCATE TABLE " . self::table_name());
    }
}
