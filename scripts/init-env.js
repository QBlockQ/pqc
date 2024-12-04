const { execSync } = require('child_process');
const path = require('path');

function initializeEmscripten() {
    try {
        const emsdkPath = path.join(process.cwd(), 'emsdk');
        const envScriptPath = path.join(emsdkPath, 'emsdk_env.sh');
        
        // Source the Emscripten environment
        execSync(`source "${envScriptPath}"`, {
            shell: '/bin/bash',
            stdio: 'inherit',
            env: {
                ...process.env,
                PATH: `${emsdkPath}:${path.join(emsdkPath, 'upstream/emscripten')}:${process.env.PATH}`
            }
        });
        
        console.log('✅ Emscripten environment initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize Emscripten environment:', error);
        process.exit(1);
    }
}

initializeEmscripten();
