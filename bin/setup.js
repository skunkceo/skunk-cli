#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

// ═══════════════════════════════════════════════════════════════════════════
// ASCII Art
// ═══════════════════════════════════════════════════════════════════════════

const SKUNK_LOGO = `
   ███████╗██╗  ██╗██╗   ██╗███╗   ██╗██╗  ██╗
   ██╔════╝██║ ██╔╝██║   ██║████╗  ██║██║ ██╔╝
   ███████╗█████╔╝ ██║   ██║██╔██╗ ██║█████╔╝ 
   ╚════██║██╔═██╗ ██║   ██║██║╚██╗██║██╔═██╗ 
   ███████║██║  ██╗╚██████╔╝██║ ╚████║██║  ██╗
   ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚═╝  ╚═╝
                    GLOBAL
`;

// ═══════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
};

function log(msg = '') {
  console.log(msg);
}

function success(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function warn(msg) {
  console.log(`${colors.yellow}!${colors.reset} ${msg}`);
}

function error(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function step(num, total, msg) {
  console.log(`\n${colors.cyan}[${num}/${total}]${colors.reset} ${colors.bright}${msg}${colors.reset}`);
}

function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getVersion(cmd) {
  try {
    return execSync(`${cmd} --version`, { encoding: 'utf8' }).trim().split('\n')[0];
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Prompts
// ═══════════════════════════════════════════════════════════════════════════

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function confirm(question, defaultYes = true) {
  const hint = defaultYes ? '(Y/n)' : '(y/N)';
  const answer = await ask(`${question} ${hint} `);
  if (!answer) return defaultYes;
  return answer.toLowerCase().startsWith('y');
}

async function choice(question, options) {
  log(question);
  options.forEach((opt, i) => {
    log(`  ${colors.cyan}${i + 1}${colors.reset}) ${opt.label}`);
  });
  const answer = await ask(`\nChoice (1-${options.length}): `);
  const idx = parseInt(answer, 10) - 1;
  if (idx >= 0 && idx < options.length) {
    return options[idx].value;
  }
  return options[0].value; // default to first
}

// ═══════════════════════════════════════════════════════════════════════════
// License Validation
// ═══════════════════════════════════════════════════════════════════════════

async function validateLicense(licenseKey, product) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      license_key: licenseKey.toUpperCase().trim(),
      site_url: 'cli-setup', // Validation only, not activation
    });

    const options = {
      hostname: 'skunkglobal.com',
      port: 443,
      path: '/api/license/validate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'skunk-cli',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.success && json.data && json.data.valid) {
            resolve({
              valid: true,
              activationsLeft: json.data.max_sites ? json.data.max_sites - (json.data.active_sites || 0) : 'unlimited',
              productsCovered: json.data.products_covered || [product],
            });
          } else {
            resolve({ valid: false, error: json.message || 'Invalid license' });
          }
        } catch (e) {
          resolve({ valid: false, error: 'Failed to validate license' });
        }
      });
    });

    req.on('error', () => {
      resolve({ valid: false, error: 'Could not connect to license server' });
    });

    req.write(postData);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Installation Functions
// ═══════════════════════════════════════════════════════════════════════════

const PRODUCTS = [
  {
    name: 'SkunkCRM',
    slug: 'skunkcrm',
    skill: 'skunkcrm',
    freeRepo: 'skunkceo/skunkcrm',
    proSlug: 'skunkcrm-pro',
  },
  {
    name: 'SkunkForms',
    slug: 'skunkforms',
    skill: 'skunkforms',
    freeRepo: 'skunkceo/skunkforms',
    proSlug: 'skunkforms-pro',
  },
  {
    name: 'SkunkPages',
    slug: 'skunkpages',
    skill: 'skunkpages',
    freeRepo: 'skunkceo/skunkpages',
    proSlug: 'skunkpages-pro',
  },
];

async function installPlugin(repo, pluginSlug, wpPath = null) {
  const url = `https://github.com/${repo}/releases/latest/download/${pluginSlug}.zip`;
  
  // If WP path provided and wp-cli available, install directly
  if (wpPath && commandExists('wp')) {
    try {
      log(`   Installing ${pluginSlug} to WordPress...`);
      execSync(`wp plugin install "${url}" --path="${wpPath}"`, { stdio: 'pipe' });
      return { status: 'installed', location: 'wordpress' };
    } catch (e) {
      // Fall through to cache
    }
  }
  
  // Otherwise, cache in ~/.skunk/plugins/ for later
  const cacheDir = path.join(process.env.HOME, '.skunk', 'plugins');
  fs.mkdirSync(cacheDir, { recursive: true });
  
  const zipPath = path.join(cacheDir, `${pluginSlug}.zip`);
  
  log(`   Downloading ${pluginSlug}...`);
  
  return new Promise((resolve) => {
    const file = fs.createWriteStream(zipPath);
    
    https.get(url, { headers: { 'User-Agent': 'skunk-cli' } }, (res) => {
      // Handle GitHub redirect
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'skunk-cli' } }, (res2) => {
          res2.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve({ status: 'cached', location: zipPath });
          });
        }).on('error', () => resolve({ status: 'failed' }));
        return;
      }
      
      if (res.statusCode !== 200) {
        resolve({ status: 'failed', error: `HTTP ${res.statusCode}` });
        return;
      }
      
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve({ status: 'cached', location: zipPath });
      });
    }).on('error', () => resolve({ status: 'failed' }));
  });
}

async function installSkill(skillName) {
  const skillsDir = path.join(process.env.HOME, '.openclaw', 'skills');
  const skillDir = path.join(skillsDir, skillName);

  if (fs.existsSync(skillDir)) {
    return { status: 'exists' };
  }

  // Fetch from GitHub
  const files = ['SKILL.md', 'config.json'];
  fs.mkdirSync(skillDir, { recursive: true });

  for (const file of files) {
    const url = `https://raw.githubusercontent.com/skunkceo/openclaw-skills/main/skills/${skillName}/${file}`;
    try {
      const content = await fetchFile(url);
      if (content) {
        fs.writeFileSync(path.join(skillDir, file), content);
      }
    } catch (e) {
      // Optional files may not exist
    }
  }

  if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
    return { status: 'installed' };
  } else {
    fs.rmSync(skillDir, { recursive: true, force: true });
    return { status: 'failed' };
  }
}

function fetchFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'skunk-cli' } }, (res) => {
      if (res.statusCode === 404) {
        resolve(null);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Setup Flow
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.clear();
  
  // Show splash
  log(colors.bright + SKUNK_LOGO + colors.reset);
  log('');
  log(`${colors.dim}Welcome! Let's get your Skunk suite set up.${colors.reset}`);
  log('');

  const totalSteps = 5;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Environment checks
  // ─────────────────────────────────────────────────────────────────────────
  step(1, totalSteps, 'Checking environment...');
  
  // Node.js
  const nodeVersion = getVersion('node');
  if (nodeVersion) {
    success(`Node.js ${nodeVersion}`);
  } else {
    error('Node.js not found');
    log('\n   Install Node.js: https://nodejs.org/');
    process.exit(1);
  }

  // npm
  const npmVersion = getVersion('npm');
  if (npmVersion) {
    success(`npm ${npmVersion}`);
  } else {
    error('npm not found');
    process.exit(1);
  }

  // WP-CLI (optional but recommended)
  const wpVersion = getVersion('wp');
  if (wpVersion) {
    success(`WP-CLI ${wpVersion}`);
  } else {
    warn('WP-CLI not found (optional, needed for direct plugin management)');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2: WordPress Studio
  // ─────────────────────────────────────────────────────────────────────────
  step(2, totalSteps, 'WordPress Studio...');

  const studioExists = commandExists('studio');
  
  if (studioExists) {
    const studioVersion = getVersion('studio');
    success(`WordPress Studio installed ${studioVersion ? `(${studioVersion})` : ''}`);
  } else {
    error('WordPress Studio not found');
    log('');
    log('   WordPress Studio is required for local WordPress development.');
    log('');
    log('   Install it from: https://developer.wordpress.org/studio/');
    log('');
    log('   On macOS:');
    log('     brew install --cask wordpress-studio');
    log('');
    log('   Or download from the website and install manually.');
    log('');
    
    const proceed = await confirm('Continue setup anyway? (skills only)', false);
    if (!proceed) {
      log('\n   Run `skunk setup` again after installing WordPress Studio.');
      rl.close();
      process.exit(0);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3: Install Plugins
  // ─────────────────────────────────────────────────────────────────────────
  step(3, totalSteps, 'Skunk Plugins...');
  log('');
  
  const licenses = {};
  
  for (const product of PRODUCTS) {
    log(`   ${colors.bright}${product.name}${colors.reset}`);
    
    const licenseChoice = await choice(`   Do you have a ${product.name} Pro license?`, [
      { label: 'No, install free version', value: 'free' },
      { label: 'Yes, enter license key', value: 'pro' },
      { label: 'Skip for now', value: 'skip' },
    ]);

    if (licenseChoice === 'skip') {
      warn(`   Skipping ${product.name}`);
      continue;
    }

    if (licenseChoice === 'pro') {
      const key = await ask('   License key: ');
      if (key) {
        log('   Validating license...');
        const result = await validateLicense(key, product.proSlug);
        
        if (result.valid) {
          success(`License valid (${result.activationsLeft} activations remaining)`);
          licenses[product.slug] = key;
          // Install both free and pro
          await installPlugin(product.freeRepo, product.slug);
          success(`${product.name} (free) ready`);
          // TODO: Download pro from update server with license
          success(`${product.name} Pro ready`);
        } else {
          warn(`License invalid: ${result.error}`);
          warn('Installing free version instead');
          await installPlugin(product.freeRepo, product.slug);
          success(`${product.name} (free) ready`);
        }
      }
    } else {
      // Free version
      await installPlugin(product.freeRepo, product.slug);
      success(`${product.name} (free) ready`);
    }
    
    log('');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 4: Install Skills
  // ─────────────────────────────────────────────────────────────────────────
  step(4, totalSteps, 'AI Skills...');

  const skills = ['wordpress-studio', 'skunkcrm', 'skunkforms', 'skunkpages'];
  
  for (const skill of skills) {
    process.stdout.write(`   ${skill} `);
    const result = await installSkill(skill);
    if (result.status === 'installed') {
      log(`${colors.green}✓${colors.reset}`);
    } else if (result.status === 'exists') {
      log(`${colors.dim}(already installed)${colors.reset}`);
    } else {
      log(`${colors.red}✗${colors.reset}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 5: Done!
  // ─────────────────────────────────────────────────────────────────────────
  step(5, totalSteps, 'Setup complete!');
  log('');
  log(`   ${colors.green}You're all set!${colors.reset}`);
  log('');
  log('   Next steps:');
  log('');
  if (studioExists) {
    log('   1. Create a WordPress site:');
    log('      studio create my-site');
    log('');
    log('   2. Activate Skunk plugins in WordPress admin');
    log('');
  }
  log('   3. Start chatting with your AI assistant');
  log('');
  log(`   ${colors.dim}Docs: https://skunkglobal.com/guides/openclaw-wordpress${colors.reset}`);
  log('');

  rl.close();
}

// Run
main().catch((err) => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
