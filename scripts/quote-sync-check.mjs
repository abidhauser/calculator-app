#!/usr/bin/env node

const toInchesFromFeet = (feet) => Number((feet * 12).toFixed(4))
const toFeetFromInches = (inches) => Number((inches / 12).toFixed(4))

const assertEqual = (name, expected, actual) => {
  if (Number.isNaN(actual) || Math.abs(actual - expected) > 1e-9) {
    console.error(`[FAIL] ${name}: expected ${expected}, got ${actual}`)
    process.exitCode = 1
    return false
  }

  console.log(`[PASS] ${name}: ${actual}`)
  return true
}

const checks = [
  () => assertEqual('10 ft -> 120 in', 120, toInchesFromFeet(10)),
  () => assertEqual('37 in -> feet', 3.0833, toFeetFromInches(37)),
  () => assertEqual('0 ft -> 0 in', 0, toInchesFromFeet(0)),
  () => assertEqual('1.25 ft -> 15 in', 15, toInchesFromFeet(1.25)),
]

let ok = true
for (const check of checks) {
  ok = check() && ok
}

if (!ok) {
  process.exit(1)
}

const roundTrip = Math.abs(toInchesFromFeet(toFeetFromInches(37)) - 37)
if (roundTrip > 1e-3) {
  console.error(`[FAIL] round-trip 37 in -> ft -> in: mismatch ${roundTrip}`)
  process.exit(1)
}

console.log('[PASS] round-trip 37 in -> ft -> in approx 37')

