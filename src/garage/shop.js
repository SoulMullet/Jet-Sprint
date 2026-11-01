import { boatPerformance, upgradeEconomy } from "./upgrades.js";
const money = (n) => "$" + Math.ceil(n).toLocaleString("en-US");
export function mountBoatShop(root, career, onResult) {
  root.innerHTML =
    '<h3>KŌWHAI MARINE / PERFORMANCE COUNTER</h3><div class="shop-tabs" role="tablist" aria-label="Boat upgrades"></div><div id="boatShopPanel" role="tabpanel"><p id="shopInstalled"></p><h4 id="shopTitle"></h4><p id="shopBenefit"></p><p id="shopPerformance"></p><strong id="shopPrice"></strong><button id="buyBoatUpgrade" class="button-primary"></button><div id="nitrousService"><div class="garage-meter" aria-label="Nitrous tank"><i id="garageNitroMeter"></i></div><p id="garageNitroTank"></p><button id="refillNitrous"></button></div><p id="shopAvailability"></p></div><button id="exportProfile">Save profile JSON backup</button>';
  const $ = (id) => root.querySelector("#" + id);
  let selected = "engine";
  const tabs = {};
  for (const [id, label] of [
    ["engine", "ENGINE"],
    ["pump", "JET PUMP"],
    ["nitrous", "NITROUS"],
  ]) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.role = "tab";
    tab.id = "shop-tab-" + id;
    tab.textContent = label;
    tab.setAttribute("aria-controls", "boatShopPanel");
    tab.onclick = () => {
      selected = id;
      refresh();
    };
    root.querySelector(".shop-tabs").append(tab);
    tabs[id] = tab;
  }
  function refresh() {
    const p = career.profile,
      b = p.boat,
      t = career.balance,
      q = career.upgradeQuote(selected),
      current = boatPerformance(b, t),
      nextBoat = { ...b };
    if (selected === "engine") nextBoat.engineStage = q.next;
    if (selected === "pump") nextBoat.pumpStage = q.next;
    const next = boatPerformance(nextBoat, t);
    for (const [id, tab] of Object.entries(tabs))
      tab.setAttribute("aria-selected", String(id === selected));
    $("boatShopPanel").setAttribute("aria-labelledby", "shop-tab-" + selected);
    $("shopInstalled").textContent =
      `ENGINE ${b.engineStage}/4 · PUMP ${b.pumpStage}/3 · NITROUS ${b.nitrousInstalled ? "FITTED" : "NOT FITTED"}`;
    $("shopTitle").textContent =
      selected === "nitrous"
        ? "NITROUS INJECTION KIT"
        : `${selected === "engine" ? "V8 ENGINE" : "JET PUMP"} / ${q.owned ? "FULLY UPGRADED" : "STAGE " + q.next}`;
    $("shopBenefit").textContent =
      selected === "engine"
        ? "More power, stronger high-speed pull and quicker engine response."
        : selected === "pump"
          ? "More efficient jet thrust, faster launch and stronger acceleration out of corners."
          : "Permanent installation, including a full first tank. Hold Left Shift + throttle, RB + RT, or continue sliding the throttle thumb upward.";
    $("shopPerformance").textContent =
      selected === "nitrous"
        ? `FULLY UPGRADED REFERENCE / ${(boatPerformance({ engineStage: 4, pumpStage: 3 }, t).topMph * (1 + t.nitroSpeedInfluence)).toFixed(0)} MPH sustained boost. Your healthy base: ${current.topMph.toFixed(1)} MPH.`
        : `HEALTHY REFERENCE / ${current.topMph.toFixed(1)} → ${next.topMph.toFixed(1)} MPH. Thrust ${current.thrustScale.toFixed(2)}× → ${next.thrustScale.toFixed(2)}×.`;
    $("shopPrice").textContent = q.owned ? "OWNED / INSTALLED" : money(q.price);
    $("buyBoatUpgrade").textContent = q.owned
      ? "INSTALLED"
      : `PURCHASE ${selected === "nitrous" ? "KIT" : "STAGE " + q.next} / ${money(q.price)}`;
    $("buyBoatUpgrade").disabled = !career.writable || !q.available;
    $("nitrousService").hidden = selected !== "nitrous";
    const refill = career.quoteNitrous();
    $("garageNitroMeter").style.width =
      (100 * b.nitrousFill) / b.nitrousCapacity + "%";
    $("garageNitroTank").textContent = b.nitrousInstalled
      ? `NITROUS ${b.nitrousFill.toFixed(1)} / ${b.nitrousCapacity} · ${(b.nitrousCapacity / t.nitroConsumption).toFixed(0)} seconds per full tank. Full refill ${money((upgradeEconomy.nitrousRefill * b.nitrousCapacity) / upgradeEconomy.tankCapacity)}.`
      : "Install once. Refills use race money; the tank never regenerates.";
    $("refillNitrous").textContent = refill.available
      ? `REFILL TO ${refill.to.toFixed(1)} / ${money(refill.cost)}`
      : b.nitrousFill >= b.nitrousCapacity
        ? "TANK FULL"
        : "REFILL UNAVAILABLE";
    $("refillNitrous").disabled = !career.writable || !refill.available;
    $("shopAvailability").textContent = p.career.activeAttempt
      ? "INSTALLATIONS & NITROUS REFILLS / BETWEEN RUNS ONLY. Fuel and hull service remain available."
      : !career.writable
        ? "Profile is read only or waiting for storage recovery."
        : "Permanent upgrades / one owned boat. Prices shown are for the next stage; partial tank refills cost only what you can store.";
  }
  $("buyBoatUpgrade").onclick = () => {
    onResult(career.buyUpgrade(selected));
    refresh();
  };
  $("refillNitrous").onclick = () => {
    onResult(career.refillNitrous());
    refresh();
  };
  refresh();
  return {
    refresh,
    get category() {
      return selected;
    },
  };
}
