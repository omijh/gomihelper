import { mkdirSync, writeFileSync } from 'fs';

async function main() {
  const stamp = new Date().toISOString().slice(0,10);
  const data = {
    ward: "Adachi-ku",
    version: stamp,
    pickups: [
      { day: "Mon", type: "burnable" },
      { day: "Tue", type: "plastic" },
      { day: "Wed", type: "paper" },
      { day: "Thu", type: "cans" },
      { day: "Fri", type: "bottles" }
    ],
    bulkyFees: [
      { item: "Small chair", feeYen: 400 },
      { item: "Bicycle", feeYen: 2000, notes: "without battery" }
    ],
    source: "manual/stub"
  };
  const dir = 'public/data/samples';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/adachi-ku@${stamp}.json`, JSON.stringify(data, null, 2));
  console.log("Updated dataset", stamp);
}

main().catch(err => { console.error(err); process.exit(1); });
