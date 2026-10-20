import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { stagePlanPose } from './stagePlan'
import { blenderBlueprint } from './blenderBridge'
import { planScale } from './planScale'

describe('stage plan projection', () => {
  it.each([0, 45, 90, -90])('matches exported stage centre at %s degrees', (rotation) => {
    const config = { ...defaultVenue, calibration: { meters: 10, pixels: 350 }, stagePosition: { offsetX: 3, offsetY: 2, rotation } }
    const pose = stagePlanPose(config), exported = blenderBlueprint(config).boxes.find((box) => box.name === 'Stage')!
    expect(pose.x).toBeCloseTo(500 + exported.position[0] * planScale(config.calibration))
    expect(pose.y).toBeCloseTo(150 + exported.position[2] * planScale(config.calibration))
    expect(pose.rotation).toBe(-rotation)
  })
})
