import { mkdirSync, writeFileSync } from 'fs';

async function main() {
  const stamp = new Date().toISOString().slice(0,10);
  const data = {
    ward: "Minato-ku",
    version: stamp,
    pickups: [
      { day: "Mon", type: "burnable" },
      { day: "Tue", type: "plastic" },
      { day: "Wed", type: "burnable" },
      { day: "Thu", type: "cans" },
      { day: "Fri", type: "paper" }
    ],
    bulkyFees: [
      { item: "Small table", feeYen: 800 },
      { item: "Office chair", feeYen: 1200 },
      { item: "Bicycle", feeYen: 2000, notes: "without battery" }
    ],
    source: "manual/stub"
  };
  const dir = 'public/data/samples';
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/minato-ku@${stamp}.json`, JSON.stringify(data, null, 2));
  console.log("Updated dataset", stamp);
}

main().catch(err => { console.error(err); process.exit(1); });
