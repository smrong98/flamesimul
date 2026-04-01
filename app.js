let gameData = null;
let isAnimating = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

fetch('data.json')
    .then(response => response.json())
    .then(data => { gameData = data; })
    .catch(error => console.error("데이터 로드 실패:", error));

document.getElementById('rollBtn').addEventListener('click', async () => {
    if (!gameData) return alert("데이터 로딩 중입니다.");
    if (isAnimating) return;
    await executeRoll(false);
});

document.getElementById('autoRollBtn').addEventListener('click', async () => {
    if (!gameData) return alert("데이터 로딩 중입니다.");
    if (isAnimating) return;
    await executeRoll(true);
});

document.getElementById('resetBtn').addEventListener('click', () => {
    if (isAnimating) return;
    resetUI();
});

function setButtonsState(disabled) {
    document.getElementById('rollBtn').disabled = disabled;
    document.getElementById('autoRollBtn').disabled = disabled;
    document.getElementById('resetBtn').disabled = disabled;
}

// 초기/리셋 상태로 되돌리는 함수
function resetUI() {
    document.getElementById('result-attempts').innerHTML = `재설정 횟수: 0회`;
    document.getElementById('result-meso-container').style.display = 'none';
    document.getElementById('result-score').innerHTML = `최종 추가옵션: 0.0급`;
    document.getElementById('result-score').style.color = '#8ab82a';
    
    document.getElementById('result-card-body').innerHTML = `<div style="color: #666; text-align: center; margin-top: 50px;">옵션 대기 중...</div>`;
    document.getElementById('result-details-content').innerHTML = `<div style="color: #666; font-size: 13px;">결과 대기 중...</div>`;
    
    document.getElementById('result-card').classList.remove('fade-in-anim');
}

async function executeRoll(isAuto) {
    isAnimating = true;
    setButtonsState(true);

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

    // 카드 애니메이션 초기화 (다시 켤 수 있도록)
    document.getElementById('result-card').classList.remove('fade-in-anim');

    if (isAuto) {
        // 실제 계산은 1초도 안 되어서 끝납니다.
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
            isAnimating = false;
            setButtonsState(false);
            return;
        }

        // ✨ 슬롯머신 연출: 더 빠르고 여러 번 돌아갑니다.
        const visualSpinCount = 25; // 깜빡일 횟수
        const visualSpeed = 30;     // 30ms 매우 빠른 속도

        for (let i = 1; i <= visualSpinCount; i++) {
            const dummyResult = performRoll(level, flameType);
            const dummyScore = calculateScore(dummyResult.finalStats, mainStat, weights);
            
            // 시각적으로 보여줄 가짜 시도 횟수 (0에서 최종 횟수까지 점진적으로 증가)
            let currentAttempt = Math.floor((attempts / visualSpinCount) * i);
            if (currentAttempt > attempts) currentAttempt = attempts;

            updateUI(dummyResult.finalStats, dummyResult.rolledDetails, dummyScore, currentAttempt, isAuto, flameType, true);
            await sleep(visualSpeed); 
        }

    } else {
        attempts = 1;
        bestResult = performRoll(level, flameType);
        finalScore = calculateScore(bestResult.finalStats, mainStat, weights);
    }

    // 최종 결과 출력 (페이드인 애니메이션 추가)
    updateUI(bestResult.finalStats, bestResult.rolledDetails, finalScore, attempts, isAuto, flameType, false);
    
    // 부드럽게 등장하는 애니메이션 클래스 부착
    document.getElementById('result-card').classList.add('fade-in-anim');

    isAnimating = false;
    setButtonsState(false);
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
    score += (mainStat === "INT" ? stats.MAGIC_ATTACK : stats.ATTACK) * weights.att;
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

// ✨ 전체 구조를 다시 그리지 않고, 내용(Text)만 빠르게 교체하는 최적화된 함수
function updateUI(stats, details, score, attempts, isAuto, flameType, isDummy) {
    const displayNames = {
        STR: "STR", DEX: "DEX", INT: "INT", LUK: "LUK",
        MAX_HP: "최대 HP", MAX_MP: "최대 MP",
        ATTACK: "공격력", MAGIC_ATTACK: "마력",
        DEFENSE: "방어력", SPEED: "이동속도", JUMP: "점프력"
    };

    // 1. 횟수 및 메소 업데이트
    document.getElementById('result-attempts').innerHTML = `재설정 횟수: ${attempts.toLocaleString()}회`;
    
    const mesoContainer = document.getElementById('result-meso-container');
    if (flameType === "검은 환생의 불꽃" && (isAuto || attempts > 0)) {
        mesoContainer.style.display = 'block';
        document.getElementById('result-meso').innerText = `소모 메소: ${(attempts * 3000000).toLocaleString()} 메소`;
    } else {
        mesoContainer.style.display = 'none';
    }

    // 2. 환산치 업데이트 (더미일 땐 일반 색상, 최종 결과일 땐 강조 색상)
    const scoreEl = document.getElementById('result-score');
    scoreEl.innerText = `최종 추가옵션: ${score.toFixed(1)}급`;
    scoreEl.style.color = isDummy ? '#aaa' : (score >= document.getElementById('targetScore').value ? "#8ab82a" : "#e57373");

    // 3. 재설정 옵션 카드 내용 업데이트
    let cardHtml = '';
    const statOrder = ["STR", "DEX", "INT", "LUK", "MAX_HP", "MAX_MP", "ATTACK", "MAGIC_ATTACK", "DEFENSE", "SPEED", "JUMP"];
    
    statOrder.forEach(key => {
        if (stats[key] > 0) {
            cardHtml += `<div class="stat-row"><span class="stat-name">${displayNames[key]} +${stats[key]}</span></div>`;
        }
    });

    if (stats.ALL_STAT > 0) cardHtml += `<div class="stat-row"><span class="stat-name">올스탯 +${stats.ALL_STAT}%</span></div>`;
    if (stats.LEVEL_REDUCTION > 0) cardHtml += `<div class="stat-row"><span class="stat-name">착용 레벨 감소 -${stats.LEVEL_REDUCTION}</span></div>`;
    
    document.getElementById('result-card-body').innerHTML = cardHtml;

    // 4. 추출된 세부 옵션 업데이트
    let detailsHtml = '';
    details.forEach(detail => {
        const nameToShow = displayNames[detail.name] || detail.name;
        let valueText = `+${detail.value}`;
        if (detail.name === "LEVEL_REDUCTION") valueText = `- ${detail.value}`;
        if (detail.name === "ALL_STAT") valueText = `+${detail.value}%`;
        detailsHtml += `<span style="font-size: 13px; color: #ccc;">[${detail.tier}] ${nameToShow} : ${valueText}</span><br>`;
    });
    
    document.getElementById('result-details-content').innerHTML = detailsHtml;
}