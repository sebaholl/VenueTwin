import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const root = document.getElementById('root')!
root.innerHTML = '<header style="padding:16px 24px"><a href="/" style="color:#a8d5fb">← VenueTwin</a><h1 style="margin:12px 0 4px">Reduta Theatre · technical geometry study</h1><p style="margin:0;max-width:75ch;color:#b4c1ca">Source: National Theatre Brno public technical SketchUp model. This is an unverified shell preview without complete seats, photographic materials or verified seat views.</p><p id="status" role="status">Loading local model…</p></header><main id="canvas" style="height:70vh;min-height:420px"></main>'
const host = document.getElementById('canvas')!
const status = document.getElementById('status')!
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
host.appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color('#263341')
scene.add(new THREE.HemisphereLight(0xffffff, 0x738190, 2.7))
const sun = new THREE.DirectionalLight(0xffffff, 3)
sun.position.set(12, 25, 12)
scene.add(sun)
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
const resize = () => { const { clientWidth: w, clientHeight: h } = host; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix() }
new ResizeObserver(resize).observe(host)
resize()
new GLTFLoader().load('/venues/reduta-study/v1/venue.glb', gltf => {
  const box = new THREE.Box3().setFromObject(gltf.scene)
  if (box.isEmpty()) { status.textContent = 'Model contains no visible geometry.'; return }
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  scene.add(gltf.scene)
  controls.target.copy(centre)
  camera.position.copy(centre).add(new THREE.Vector3(size.x * 1.2, size.y * 1.3, size.z * 1.2))
  camera.near = 0.1; camera.far = Math.max(500, size.length() * 10); camera.updateProjectionMatrix()
  controls.update()
  status.textContent = `Loaded public-source shell (${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} m). Drag to orbit, scroll to zoom.`
}, undefined, () => { status.textContent = 'Local model missing. Run the Reduta import command in docs/CZECH_VENUE_SOURCE_AUDIT.md.' })
function frame() { requestAnimationFrame(frame); controls.update(); renderer.render(scene, camera) }
frame()
