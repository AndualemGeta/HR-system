import { spawn } from 'child_process'

const PORT = parseInt(process.env.TEST_PORT || '3002', 10)
const BASE = `http://127.0.0.1:${PORT}`

async function waitForServer(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok || res.status === 404) return
    } catch {}
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`)
}

async function main() {
  console.log(`Starting Next.js server on port ${PORT}...`)

  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, PORT: String(PORT) },
  })

  let serverOutput = ''
  server.stdout?.on('data', (d: Buffer) => { serverOutput += d.toString() })
  server.stderr?.on('data', (d: Buffer) => { serverOutput += d.toString() })

  let exitCode = 1
  try {
    await waitForServer(BASE)
    console.log('Server is ready.')

    const testProc = spawn('npx', ['tsx', 'src/test/kpi-assignment-e2e-tests.ts'], {
      stdio: 'inherit',
      env: { ...process.env, TEST_BASE_URL: BASE },
    })

    exitCode = await new Promise<number>((resolve) => {
      testProc.on('exit', (code) => resolve(code ?? 1))
    })
  } catch (e) {
    console.error('Server failed to start:', e)
    console.error('Server output:', serverOutput.slice(-2000))
  } finally {
    server.kill('SIGTERM')
    setTimeout(() => { server.kill('SIGKILL') }, 3000)
    await new Promise(r => setTimeout(r, 1000))
  }

  process.exit(exitCode)
}

main().catch(e => { console.error(e); process.exit(1) })
