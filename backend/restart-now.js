const { exec, spawn } = require('child_process');
const process = require('process');

console.log('🔄 Restarting backend on port 3002...');

// Kill existing processes
exec('killall -9 node tsx 2>/dev/null; lsof -ti:3002 | xargs kill -9 2>/dev/null', (error) => {
  console.log('✅ Killed existing processes');
  
  setTimeout(() => {
    console.log('🚀 Starting backend...');
    
    // Start backend
    const backend = spawn('npm', ['run', 'dev'], {
      cwd: '/var/www/Dev-Koncepts/backend',
      env: { ...process.env, PORT: '3002' },
      detached: true,
      stdio: 'ignore'
    });
    
    backend.unref();
    
    console.log('✅ Backend started on port 3002');
    console.log('📝 Test: curl http://localhost:3002/api/health');
    
    process.exit(0);
  }, 2000);
});
