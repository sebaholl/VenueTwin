import { ContactShadows, Environment, OrbitControls, RoundedBox, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useMemo } from 'react'
import type { SeatRef, VenueConfig } from '../types/venue'
import { generateSeatLayout } from '../utils/venue'

type SceneProps = {
  config: VenueConfig
  selectedSeat: SeatRef | null
  onSeatSelect: (seat: SeatRef) => void
}

function VenueModel({ config, selectedSeat, onSeatSelect }: SceneProps) {
  const seats = useMemo(() => generateSeatLayout(config), [config])
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const stageRotation = stage.rotation * Math.PI / 180

  return (
    <group position={[0, -1.4, -2.8]}>
      <group position={[stage.offsetX, 0, stage.offsetY]} rotation={[0, stageRotation, 0]}>
        <RoundedBox args={[config.stageWidth, 0.45, 2.2]} radius={0.12} position={[0, 0, -2.2]}>
          <meshStandardMaterial color="#17243a" roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 2.7, -3.25]}>
          <planeGeometry args={[config.stageWidth * 0.84, 4.6]} />
          <meshStandardMaterial color="#e8f0f3" emissive="#19304b" emissiveIntensity={0.16} />
        </mesh>
        <Text position={[0, 2.7, -3.18]} fontSize={0.42} color="#07111f" anchorX="center">VENUE TWIN</Text>
      </group>
      {seats.map((seat) => {
        const active = selectedSeat?.label === seat.label
        return (
          <group
            key={seat.label}
            position={seat.position}
            rotation={[0, seat.rotation, 0]}
            onClick={(event) => { event.stopPropagation(); onSeatSelect(seat) }}
          >
            <RoundedBox args={[0.48, 0.48, 0.48]} radius={0.1} position={[0, 0.34, 0]}>
              <meshStandardMaterial color={active ? '#ff7a59' : '#5be2c3'} roughness={0.38} />
            </RoundedBox>
            <RoundedBox args={[0.52, 0.16, 0.52]} radius={0.07} position={[0, 0.04, -0.05]}>
              <meshStandardMaterial color={active ? '#d95136' : '#183349'} />
            </RoundedBox>
          </group>
        )
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, config.rows * 0.5]}>
        <planeGeometry args={[26, 28]} />
        <meshStandardMaterial color="#0c1725" roughness={0.9} />
      </mesh>
    </group>
  )
}

export function VenueScene(props: SceneProps) {
  return (
    <Canvas camera={{ position: [11, 11, 18], fov: 44 }} dpr={[1, 1.6]}>
      <color attach="background" args={['#07111f']} />
      <fog attach="fog" args={['#07111f', 24, 48]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 12, 8]} intensity={2.4} color="#e6fff8" />
      <Suspense fallback={null}>
        <VenueModel {...props} />
        <Environment preset="city" />
        <ContactShadows position={[0, -1.35, 2]} opacity={0.42} scale={30} blur={2.5} />
      </Suspense>
      <OrbitControls makeDefault target={[0, 1.7, 2]} minDistance={8} maxDistance={32} maxPolarAngle={Math.PI / 2.04} />
    </Canvas>
  )
}
