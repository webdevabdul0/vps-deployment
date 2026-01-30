/**
 * PM2 Ecosystem Configuration - Optimized for shared VPS with n8n
 * This configuration ensures minimal resource usage while maintaining reliability
 */

module.exports = {
  apps: [{
    name: 'flossy-widget',
    script: 'server.js',
    
    // Resource optimization for shared VPS
    instances: 1, // Single instance to minimize memory usage
    exec_mode: 'fork', // Fork mode uses less memory than cluster
    
    // Memory management
    max_memory_restart: '150M', // Restart if memory exceeds 150MB
    
    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3001 // Different from n8n (usually 5678)
    },
    
    // Load environment variables from .env file
    env_file: '.env.production',
    
    // Logging (lightweight)
    log_file: '/var/log/flossy-widget/combined.log',
    out_file: '/var/log/flossy-widget/out.log',
    error_file: '/var/log/flossy-widget/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Auto-restart configuration
    autorestart: true,
    watch: false, // Disable file watching to save resources
    max_restarts: 10,
    min_uptime: '10s',
    
    // Performance monitoring
    pmx: false, // Disable PMX to save memory
    
    // Advanced settings for VPS optimization
    node_args: [
      '--max-old-space-size=128', // Limit Node.js heap to 128MB
      '--optimize-for-size' // Optimize for memory usage over speed
    ],
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true
  }]
};
