import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildRedutaStudySeats } from './reduta-study-seats'
import { buildRedutaStudyFinishes } from './reduta-study-finishes'

const root = document.getElementById('root')!
root.innerHTML = '<header style="padding:16px 24px"><a href="/" style="color:#a8d5fb">← VenueTwin</a><h1 style="margin:12px 0 4px">Reduta Theatre · photo-guided geometry study</h1><p style="margin:0;max-width:80ch;color:#b4c1ca">Official technical SketchUp shell and a visual seating pass guided by the supplied photos and section drawing. Seat positions and views are estimated; this is not a surveyed or approved replica.</p><div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px"><label for="seat">Estimated seat view</label><select id="seat" aria-label="Estimated seat view" style="padding:9px;max-width:240px;background:#f1f5f9;color:#15202b;border-radius:5px"><option value="">Choose a seat</option></select><button id="overview" type="button" style="padding:10px;border:0;border-radius:5px;cursor:pointer">Overview</button></div><p id="status" role="status">Loading local model…</p></header><main id="canvas" style="height:70vh;min-height:420px"></main>'
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
  const size = box.getSize(new THREE.Vector3())
  scene.add(gltf.scene)
  let study
  try { study = buildRedutaStudySeats(gltf.scene) }
  catch { status.textContent = 'The source model floor does not match this study. Re-run the import and inspect the official source revision.'; return }
  const { group, seats } = study
  scene.add(group)
  scene.add(buildRedutaStudyFinishes())
  const overview = () => {
    camera.position.set(13.75, 4.2, -21.6)
    camera.fov = 66
    controls.target.set(13.75, 2.3, -11.5)
    camera.updateProjectionMatrix()
    controls.update()
    status.textContent = `Official technical shell: ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} m bounds. ${seats.length} photo-guided stalls seats placed on its stepped floor; their coordinates are inferred.`
  }
  const select = document.getElementById('seat') as HTMLSelectElement
  for (const seat of seats) select.add(new Option(seat.label, seat.id))
  select.addEventListener('change', () => {
    const seat = seats.find(item => item.id === select.value)
    if (!seat) return
    camera.position.copy(seat.eye)
    camera.fov = 62
    controls.target.set(13.75, 1.6, -24.1)
    camera.updateProjectionMatrix()
    controls.update()
    status.textContent = `${seat.label}: illustrative eye view from an inferred position, not an official numbered seat or validated sightline.`
  })
  document.getElementById('overview')!.addEventListener('click', () => { select.value = ''; overview() })
  camera.near = 0.1; camera.far = Math.max(500, size.length() * 10); camera.updateProjectionMatrix()
  overview()
}, undefined, () => { status.textContent = 'Local model missing. Run the Reduta import command in docs/CZECH_VENUE_SOURCE_AUDIT.md.' })
function frame() { requestAnimationFrame(frame); controls.update(); renderer.render(scene, camera) }
frame()
