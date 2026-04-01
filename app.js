let gameData = null;

fetch('data.json')
    .then(response => response.json())
    .then(data => { gameData = data; })
    .catch(error => console.error("데이터 로드 실패:", error));

document.getElementById('rollBtn').addEventListener('click', () => {
    if (!gameData) return alert("데이터 로딩 중입니다.");
    executeRoll(false);
});

document.getElementById('autoRollBtn').addEventListener('click', () => {
    if (!gameData) return alert("데이터 로딩 중입니다.");
    executeRoll(true);
});

// ✨ 초기화 버튼 이벤트 리스너 추가
document.getElementById('resetBtn').addEventListener('click', () => {
    document.getElementById('result').innerHTML = ''; // 결과창 비우기
});

function executeRoll(isAuto) {
    const level = document.getElementById('levelSelect').value;
    const flameType = document.getElementById('flameSelect').value;
    const mainStat = document.getElementById('mainStatSelect').value;
    const targetScore = parseFloat(document.getElementById('targetScore').value);
    
    const weights = {
        sub: parseFloat(document.getElementById('subWeight').value),
        att: parseFloat(document.getElementById('attWeight').value),
        allStat: parseFloat(document.getElementById('allStatWeight').value)
    };

    let attempts = 0;
    const maxAttempts = 50000;
    let bestResult = null;
    let finalScore = 0;

    if (isAuto) {
        while (attempts < maxAttempts) {
            attempts++;
            const result = performRoll(level, flameType);
            const score = calculateScore(result.finalStats, mainStat, weights);
            
            if (score >= targetScore) {
                bestResult = result;
                finalScore = score;
                break;
            }
        }

        if (attempts >= maxAttempts) {
            alert(`${maxAttempts}번 돌렸지만 목표치에 도달하지 못했습니다. 목표를 낮춰보세요.`);
            return;
        }
    } else {
        attempts = 1;
        bestResult = performRoll(level, flameType);
        finalScore = calculateScore(bestResult.finalStats, mainStat, weights);
    }

    // ✨ 렌더링 함수에 flameType도 같이 넘겨서 메소 계산에 사용합니다.
    renderTooltip(bestResult.finalStats, bestResult.rolledDetails, finalScore, attempts, isAuto, flameType);
}

function performRoll(level, flameType) {
    const shuffledOptions = [...gameData.options_list].sort(() => 0.5 - Math.random());
    const selectedOptions = shuffledOptions.slice(0, 4);
    const probabilities = gameData.flame_probabilities[flameType];

    const finalStats = { STR: 0, DEX: 0, INT: 0, LUK: 0, MAX_HP: 0, MAX_MP: 0, LEVEL_REDUCTION: 0, DEFENSE: 0, ATTACK: 0, MAGIC_ATTACK: 0, SPEED: 0, JUMP: 0, ALL_STAT: 0 };
    const rolledDetails = []; 
    const doubleStats = ["STR_DEX", "STR_INT", "STR_LUK", "DEX_INT", "DEX_LUK", "INT_LUK"];

    selectedOptions.forEach(option => {
        const tier = getRandomTier(probabilities);
        const statValue = calculateStatValue(option, tier, level);
        if (statValue === 0) return;

        rolledDetails.push({ name: option, tier: tier, value: statValue });

        if (doubleStats.includes(option)) {
            const [stat1, stat2] = option.split("_");
            finalStats[stat1] += statValue;
            finalStats[stat2] += statValue;
        } else {
            finalStats[option] += statValue;
        }
    });

    return { finalStats, rolledDetails };
}

function calculateScore(stats, mainStat, weights) {
    let score = stats[mainStat];
    let subStat = "";
    if (mainStat === "STR") subStat = "DEX";
    if (mainStat === "DEX") subStat = "STR";
    if (mainStat === "INT") subStat = "LUK";
    if (mainStat === "LUK") subStat = "DEX";

    score += (stats[subStat] * weights.sub);

    if (mainStat === "INT") {
        score += (stats.MAGIC_ATTACK * weights.att);
    } else {
        score += (stats.ATTACK * weights.att);
    }

    score += (stats.ALL_STAT * weights.allStat);
    return score;
}

function getRandomTier(probabilities) {
    let rand = Math.random();
    let cumulativeProbability = 0;
    for (const [tier, prob] of Object.entries(probabilities)) {
        cumulativeProbability += prob;
        if (rand <= cumulativeProbability) return tier;
    }
    return "4";
}

function calculateStatValue(option, tier, level) {
    const t = parseInt(tier);
    const doubleStats = ["STR_DEX", "STR_INT", "STR_LUK", "DEX_INT", "DEX_LUK", "INT_LUK"];
    let baseValue = 0;

    if (["STR", "DEX", "INT", "LUK"].includes(option)) {
        baseValue = gameData.level_base[level]["SINGLE"];
    } else if (doubleStats.includes(option)) {
        baseValue = gameData.level_base[level]["DOUBLE"];
    } else if (["MAX_HP", "MAX_MP", "DEFENSE"].includes(option)) {
        baseValue = gameData.level_base[level][option];
    } else if (gameData.common_base[option]) {
        baseValue = gameData.common_base[option];
    }
    return Math.round(baseValue * t); 
}

// ✨ flameType 파라미터가 추가되었습니다.
function renderTooltip(stats, details, score, attempts, isAuto, flameType) {
    const resultDiv = document.getElementById('result');
    const displayNames = {
        STR: "STR", DEX: "DEX", INT: "INT", LUK: "LUK",
        MAX_HP: "최대 HP", MAX_MP: "최대 MP",
        ATTACK: "공격력", MAGIC_ATTACK: "마력",
        DEFENSE: "방어력", SPEED: "이동속도", JUMP: "점프력"
    };

    let html = ``;

    const highlightColor = score >= document.getElementById('targetScore').value ? "blue" : "#d32f2f";
    html += `<div style="margin-bottom: 15px; padding: 12px; background: #e3f2fd; border: 1px solid #90caf9; border-radius: 5px;">`;
    
    // ✨ 메소 계산 로직 (검은 환생의 불꽃인 경우 1회당 300만 메소 추가)
    let mesoText = "";
    if (flameType === "검은 환생의 불꽃") {
        const totalMeso = attempts * 3000000;
        mesoText = ` / <span style="color: #e65100;">소모 메소: ${totalMeso.toLocaleString()} 메소</span>`;
    }

    if (isAuto) {
        html += `<strong>🎉 목표 달성! (환불 소모량: ${attempts.toLocaleString()}개${mesoText})</strong><br>`;
    } else {
        html += `<strong>🎲 1회 사용 결과 (환불 소모량: 1개${mesoText})</strong><br>`;
    }
    html += `<span style="color: ${highlightColor}; font-weight: bold; font-size: 16px;">🔥 최종 환산치: ${score.toFixed(1)}급</span>`;
    html += `</div>`;

    html += `<div style="margin-bottom: 10px; padding: 10px; background: #fff; border: 1px dashed #ccc;">`;
    html += `<strong>[추출된 세부 옵션]</strong><br>`;
    details.forEach(detail => {
        const nameToShow = displayNames[detail.name] || detail.name;
        let valueText = `+${detail.value}`;
        if (detail.name === "LEVEL_REDUCTION") valueText = `- ${detail.value}`;
        if (detail.name === "ALL_STAT") valueText = `+${detail.value}%`;
        html += `<span style="font-size: 13px; color: #555;">[${detail.tier}] ${nameToShow} : ${valueText}</span><br>`;
    });
    html += `</div>`;

    html += `<div class="maple-tooltip">`;
    const statOrder = ["STR", "DEX", "INT", "LUK", "MAX_HP", "MAX_MP", "ATTACK", "MAGIC_ATTACK", "DEFENSE", "SPEED", "JUMP"];
    
    statOrder.forEach(key => {
        if (stats[key] > 0) {
            html += `<div class="stat-row">
                        <span class="stat-name">${displayNames[key]} :</span>
                        <span class="bonus-stat">+${stats[key]}</span>
                     </div>`;
        }
    });

    if (stats.ALL_STAT > 0) {
        html += `<div class="stat-row"><span class="stat-name">올스탯 :</span><span class="bonus-stat">+${stats.ALL_STAT}%</span></div>`;
    }
    if (stats.LEVEL_REDUCTION > 0) {
        html += `<div class="stat-row"><span class="stat-name">착용 레벨 감소 :</span><span class="bonus-stat">- ${stats.LEVEL_REDUCTION}</span></div>`;
    }

    html += `</div>`;
    resultDiv.innerHTML = html;
}