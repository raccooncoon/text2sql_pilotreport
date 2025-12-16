
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const users = ['user_01', 'user_02', 'user_03', 'user_04', 'user_05', 'user_08', 'user_10', 'user_12', 'manager', 'admin'];
const models = ['GPT-4', 'Claude 3.5', 'Llama 3'];
const statuses = ['SUCCESS', 'SUCCESS', 'SUCCESS', 'SUCCESS', 'FAIL', 'ERROR', 'BLOCKED']; // Weigh success higher
const stages = [
    '1. 모델 상태 확인',
    '2. 질문 분석',
    '3. 메타 조회',
    '4. SQL 생성',
    '5. 결과 요약'
];
const questions = [
    "일별 매출 현황 보여줘",
    "이번 달 가장 많이 팔린 상품 10개",
    "강남구 지역 배달 지연 건수",
    "VIP 고객 리스트 추출해줘",
    "서버 로그 중 에러 발생 비율",
    "재고 부족 상품 알림 설정해줘",
    "최근 3개월간 월별 사용자 증가 추이",
    "마케팅 캠페인 효율 분석 리포트",
    "결제 수단별 매출 비중 파이 차트로",
    "특정 IP에서 시도된 비정상 접근 로그",
    "2025년 12월 17일 기준으로 서울 지역에서 가장 많이 팔린 상위 5개 품목의 매출 트렌드를 월별로 비교해서 보여주고 전년 대비 성장률도 함께 계산해줘",
    "최근 3개월 동안 발생한 시스템 에러 로그 중에서 'Timeout' 관련 오류가 발생한 시간대별 빈도수를 분석하고 특정 서버에 집중되어 있는지 확인해줘",
    "이번 달 마케팅 캠페인 'Winter Sale'을 통해 유입된 신규 고객들의 첫 구매 평균 금액과 재구매율이 어떻게 되는지 궁금해",
    "현재 데이터베이스의 활성 세션 수가 임계치를 초과하는 경우가 잦은데 주로 어떤 쿼리가 리소스를 많이 점유하고 있는지 실행 계획이 비효율적인 상위 10개 쿼리 추출해줘",
    "재고 관리 시스템에서 현재 '품절 임박' 상태인 상품들 중에서 재입고 예정일이 설정되어 있지 않은 상품 리스트를 뽑아주고 담당 MD 정보도 같이 표시해줘",
    "고객 만족도 설문조사 결과에서 '배송' 관련 키워드가 포함된 부정적인 피드백만 따로 필터링해서 보고 싶고 해당 주문의 배송 지연 여부도 같이 확인해줘",
    "앱 다운로드 수가 가장 많은 국가 상위 10곳의 최근 1주일간 DAU(Daily Active Users) 추이를 꺾은선 그래프로 비교하고 싶어 데이터 준비해줘",
    "상품 리뷰 텍스트 마이닝 결과에서 '가성비', '디자인', '품질' 세 가지 키워드에 대한 긍정/부정 비율이 제품 카테고리별로 어떻게 다른지 비교 분석해줘",
    "30대 여성 고객들이 가장 선호하는 색상 옵션이 무엇인지 의류 카테고리 판매 데이터를 기반으로 분석하고 재고가 충분한지 확인해줘",
    "분기별 재무 보고서 작성을 위해 필요한 매출, 영업이익, 순이익 데이터를 지난 3년 치를 월 단위로 정리해서 엑셀로 다운로드할 수 있게 표로 만들어줘"
];

const startDate = new Date('2025-12-17');
const endDate = new Date('2025-12-24');
const totalRecords = 120;

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatTime(date) {
    return date.toTimeString().split(' ')[0];
}

const csvRows = ['id,user,chat,query,model,stage,latency,status,feedback,date,time,retryCount'];
let counter = 1;

for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dailyCount = Math.floor(totalRecords / 8) + randomInt(-2, 3); // Approx 15 per day

    for (let i = 0; i < dailyCount; i++) {
        const id = `Q-PILOT-${String(counter).padStart(3, '0')}`;
        const user = randomItem(users);
        const chat = `C-${randomInt(100, 999)}`;
        const query = randomItem(questions);
        const model = randomItem(models);

        const status = randomItem(statuses);
        let stage;
        if (status === 'SUCCESS') {
            stage = '5. 결과 요약';
        } else if (status === 'BLOCKED') {
            stage = '1. 모델 상태 확인';
        } else if (status === 'ERROR') {
            stage = randomItem(['3. 메타 조회', '4. SQL 생성']);
        } else { // FAIL
            stage = randomItem(['2. 질문 분석', '3. 메타 조회']);
        }

        const latency = (Math.random() * 2.5 + 0.3).toFixed(1) + 's';

        let feedback = '';
        if (status === 'SUCCESS') {
            feedback = Math.random() > 0.3 ? randomInt(3, 5) : '';
        } else {
            feedback = Math.random() > 0.5 ? randomInt(1, 2) : '';
        }

        // Random time in working hours 09:00 - 19:00
        const timeDate = new Date(d);
        timeDate.setHours(randomInt(9, 19), randomInt(0, 59), randomInt(0, 59));

        const retryCount = status !== 'SUCCESS' && status !== 'BLOCKED' ? randomInt(0, 3) : 0;

        csvRows.push(`${id},${user},${chat},"${query.replace(/"/g, '""')}",${model},${stage},${latency},${status},${feedback},${formatDate(d)},${formatTime(timeDate)},${retryCount}`);
        counter++;
    }
}

const outputPath = path.join(__dirname, 'sample_logs_pilot_period_100.csv');
fs.writeFileSync(outputPath, csvRows.join('\n'));
console.log(`Generated ${csvRows.length - 1} records to ${outputPath}`);
