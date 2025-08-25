document.addEventListener("DOMContentLoaded", () => {
  /* ===== Tunable assumptions ===== */
  const USAGE_HOURS_PER_DAY = 4;   // avg use per selected appliance (hours/day)
  const SUN_HOURS_PER_DAY   = 4.5; // avg effective sun hours/day
  const SYSTEM_LOSS_FACTOR  = 0.85; // 85% net after losses
  const GRID_RATE           = 0.22; // $/kWh (update for your region)

  /* ===== Element refs (optional if absent) ===== */
  const steps = document.querySelectorAll(".step");
  const needsWattsEl = document.getElementById("needs-watts");
  const totalCostEl  = document.getElementById("total-cost");
  const gridCostEl   = document.getElementById("grid-cost");
  const savingsEl    = document.getElementById("solar-savings");
  const roiEl        = document.getElementById("roi");
  const backupHoursEl= document.getElementById("backup-hours");
  const futureReadyEl= document.getElementById("future-ready");
  const liquid       = document.querySelector(".liquid");
  const scoreEl      = document.querySelector(".score");

  const nextBtn = document.querySelector(".next");
  const prevBtn = document.querySelector(".prev");

  /* ===== State (derived from DOM each calc) ===== */
  let currentStep = 0;

  function showStep(i) {
    if (!steps.length) return;
    steps.forEach((s, idx) => s.classList.toggle("active", idx === i));
  }

  /* ===== Helpers ===== */
  const toInt = (v) => Number.parseInt(v, 10) || 0;
  const toNum = (v) => Number.parseFloat(v) || 0;

  function getApplianceTotals() {
    // Sum watts based on count * data-watts
    const nodes = document.querySelectorAll(".appliance");
    let sumWatts = 0;
    nodes.forEach((appl) => {
      const watts = toInt(appl.dataset.watts);
      const countEl = appl.querySelector(".count");
      const count = countEl ? toInt(countEl.textContent) : 0;
      sumWatts += watts * count;
    });
    return { totalWattsSelected: sumWatts };
  }

  function getProductTotals() {
    // Sum cost; also collect counts/power for ROI & reliability
    const nodes = document.querySelectorAll(".product");
    let totalCost = 0;

    let panelCount = 0;
    let panelWattsEach = 0;

    let batteryCount = 0;
    let batteryKwhEach = 0;

    let inverterCount = 0;

    nodes.forEach((prod) => {
      const price = toNum(prod.dataset.price);
      const count = toInt(prod.querySelector(".count")?.textContent);
      totalCost += price * count;

      const name = (prod.dataset.name || "").toLowerCase();
      if (name.includes("panel")) {
        panelCount += count;
        panelWattsEach = toInt(prod.dataset.watts) || panelWattsEach;
      } else if (name.includes("battery")) {
        batteryCount += count;
        batteryKwhEach = toNum(prod.dataset.kwh) || batteryKwhEach;
      } else if (name.includes("inverter")) {
        inverterCount += count;
      }
    });

    return {
      totalCost,
      panelCount,
      panelWattsEach,
      batteryCount,
      batteryKwhEach,
      inverterCount
    };
  }

  function calcAnnualConsumptionKWh(totalWattsSelected) {
    // kWh/year from appliances selection (using avg daily hours)
    const kWhPerDay = (totalWattsSelected * USAGE_HOURS_PER_DAY) / 1000;
    return kWhPerDay * 365;
  }

  function calcAnnualSolarGenKWh(panelCount, panelWattsEach) {
    // kWh/year from panels (with losses)
    const systemWatts = panelCount * panelWattsEach;
    const kWhPerDay = (systemWatts * SUN_HOURS_PER_DAY * SYSTEM_LOSS_FACTOR) / 1000;
    return kWhPerDay * 365;
  }

  function updateNeeds() {
    const { totalWattsSelected } = getApplianceTotals();
    if (needsWattsEl) needsWattsEl.textContent = totalWattsSelected;
    return totalWattsSelected;
  }

  function updateROI(totalWattsSelected) {
    const {
      totalCost, panelCount, panelWattsEach
    } = getProductTotals();

    // Annual consumption (kWh)
    const annualConsumption = calcAnnualConsumptionKWh(totalWattsSelected);

    // Annual solar generation (kWh)
    const annualSolar = calcAnnualSolarGenKWh(panelCount, panelWattsEach);

    // Usable offset cannot exceed consumption
    const annualOffset = Math.min(annualConsumption, annualSolar);

    // Costs/savings
    const gridCost = annualConsumption * GRID_RATE;
    const solarSavings = annualOffset * GRID_RATE;
    const roiYears = solarSavings > 0 ? (totalCost / solarSavings) : null;

    if (totalCostEl) totalCostEl.textContent = totalCost.toFixed(0);
    if (gridCostEl)  gridCostEl.textContent  = gridCost.toFixed(0);
    if (savingsEl)   savingsEl.textContent   = solarSavings.toFixed(0);
    if (roiEl)       roiEl.textContent       = roiYears ? roiYears.toFixed(1) : "--";

    return {
      totalCost,
      annualConsumption,
      annualSolar,
      annualOffset,
      gridCost,
      solarSavings,
      roiYears
    };
  }

  function updateReliability(totalWattsSelected) {
    const { batteryCount, batteryKwhEach } = getProductTotals();
    const totalBatteryKWh = batteryCount * batteryKwhEach;

    // Estimate "critical loads" as a portion of selected loads (or minimum baseline)
    const criticalWatts = Math.max(150, Math.round(totalWattsSelected * 0.4));

    // Backup hours = (total stored Wh) / (critical W)
    const backupHours = criticalWatts > 0 ? (totalBatteryKWh * 1000) / criticalWatts : 0;

    if (backupHoursEl) backupHoursEl.textContent = backupHours.toFixed(1);
    return { backupHours, totalBatteryKWh, criticalWatts };
  }

  function updateFuture() {
    // If you have future-ready checkboxes, give them data-points
    // Example selector: input.future-toggle[type=checkbox][data-points]
    let points = 0;
    document.querySelectorAll("input.future-toggle[type=checkbox][data-points]")
      .forEach((cb) => { if (cb.checked) points += toInt(cb.dataset.points); });
    if (futureReadyEl) futureReadyEl.textContent = points;
    return points; // 0..100 recommended
  }

  function updateScore(roiYears, backupHours, futurePoints, annualConsumption) {
    // Score components (0..100). Tunable mappings:
    // ROI: 0 yrs => 100, 15+ yrs => 0 (linear)
    let roiScore = 0;
    if (roiYears && roiYears > 0) {
      roiScore = Math.max(0, Math.min(100, 100 * (1 - (roiYears / 15))));
    }

    // Reliability: 24h => 100, cap at 100
    const reliabilityScore = Math.max(0, Math.min(100, (backupHours / 24) * 100));

    // Future points already 0..100 if you set it that way
    const futureScore = Math.max(0, Math.min(100, futurePoints));

    // Efficiency penalty: very high annual consumption reduces overall by up to 30%
    //  <= 4000 kWh/yr => no penalty; 14000+ => max penalty
    let penaltyFactor = 1;
    if (annualConsumption > 4000) {
      const over = Math.min(annualConsumption - 4000, 10000);
      penaltyFactor = 1 - (0.30 * (over / 10000));
    }

    const composite = (roiScore * 0.45) + (reliabilityScore * 0.30) + (futureScore * 0.25);
    const finalScore = Math.round(composite * penaltyFactor);

    if (liquid)   liquid.style.height = `${Math.max(0, Math.min(100, finalScore))}%`;
    if (scoreEl)  scoreEl.textContent = `${Math.max(0, Math.min(100, finalScore))}%`;

    return finalScore;
  }

  function recalcAll() {
    const totalWattsSelected = updateNeeds();
    const roi = updateROI(totalWattsSelected);
    const rel = updateReliability(totalWattsSelected);
    const futurePoints = updateFuture();
    updateScore(roi.roiYears, rel.backupHours, futurePoints, roi.annualConsumption);
  }

  /* ===== Wire up + / – for appliances ===== */
  document.querySelectorAll(".appliance").forEach((appl) => {
    const plus  = appl.querySelector(".plus");
    const minus = appl.querySelector(".minus");
    const countEl = appl.querySelector(".count");

    if (plus) {
      plus.addEventListener("click", () => {
        countEl.textContent = toInt(countEl.textContent) + 1;
        recalcAll();
      });
    }
    if (minus) {
      minus.addEventListener("click", () => {
        const next = Math.max(0, toInt(countEl.textContent) - 1);
        countEl.textContent = next;
        recalcAll();
      });
    }
  });

  /* ===== Wire up + / – for products (panels, batteries, inverters) ===== */
  document.querySelectorAll(".product").forEach((prod) => {
    const plus  = prod.querySelector(".plus");
    const minus = prod.querySelector(".minus");
    const countEl = prod.querySelector(".count");

    if (plus) {
      plus.addEventListener("click", () => {
        countEl.textContent = toInt(countEl.textContent) + 1;
        recalcAll();
      });
    }
    if (minus) {
      minus.addEventListener("click", () => {
        const next = Math.max(0, toInt(countEl.textContent) - 1);
        countEl.textContent = next;
        recalcAll();
      });
    }
  });

  /* ===== Optional: future toggles & critical-loads select ===== */
  document.querySelectorAll("input.future-toggle[type=checkbox][data-points]")
    .forEach((cb) => cb.addEventListener("change", recalcAll));

  const criticalSelect = document.getElementById("critical-loads");
  if (criticalSelect) {
    criticalSelect.addEventListener("change", () => {
      // You can refine reliability here by mapping selection to a factor.
      // Example: change USAGE_HOURS_PER_DAY or critical loads fraction dynamically.
      recalcAll();
    });
  }

  /* ===== Step navigation (if present) ===== */
  if (nextBtn) nextBtn.addEventListener("click", () => {
    if (steps.length && currentStep < steps.length - 1) {
      currentStep += 1; showStep(currentStep);
    }
  });
  if (prevBtn) prevBtn.addEventListener("click", () => {
    if (steps.length && currentStep > 0) {
      currentStep -= 1; showStep(currentStep);
    }
  });

  // Init
  showStep(currentStep);
  recalcAll();
});



document.addEventListener("DOMContentLoaded", () => {
  const addBatteryBtn = document.querySelector(".add-battery");
  if (addBatteryBtn) {
    addBatteryBtn.addEventListener("click", () => {
      const prevBtn = document.querySelector(".prev");
      if (prevBtn) prevBtn.click(); // simulate Prev

      const batteryProd = document.querySelector(".product:nth-child(3)");
      if (batteryProd) {
        batteryProd.classList.add("highlight");
        batteryProd.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  }
});