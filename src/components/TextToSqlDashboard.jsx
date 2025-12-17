import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList,
    PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import {
    Activity, Database, AlertTriangle, Clock,
    ArrowRight, List, Settings,
    ChevronRight, RefreshCw, Download, MoreHorizontal, ChevronDown, ChevronUp,
    Home, Box, BarChart2, User, MessageSquare, HelpCircle, Star, Calendar, TrendingUp, Filter, Cpu
} from 'lucide-react';
import initialCsvData from '../data/mockdata.csv?raw';

// Icon Mapping
const iconMap = {
    User: User,
    MessageSquare: MessageSquare,
    HelpCircle: HelpCircle,
    Star: Star,
    Cpu: Cpu
};

// --- Helper Functions ---
const parseCSV = (str) => {
    const arr = [];
    let quote = false;  // 'true' means we're inside a quoted field
    let col = 0;
    let row = 0;

    // Initialize first row and col
    arr[0] = [];
    arr[0][0] = "";

    for (let c = 0; c < str.length; c++) {
        let cc = str[c];      // Current character
        let nc = str[c + 1];    // Next character

        arr[row] = arr[row] || [];
        arr[row][col] = arr[row][col] || "";

        if (cc == '"' && quote && nc == '"') {
            // Double quote inside quoted field -> escape it (add one quote)
            arr[row][col] += cc;
            ++c; // Skip next quote
            continue;
        }

        if (cc == '"') {
            quote = !quote;
            continue;
        }

        if (cc == ',' && !quote) {
            ++col;
            continue;
        }

        if (cc == '\r' && nc == '\n' && !quote) {
            ++row;
            col = 0;
            ++c; // Skip newline
            continue;
        }

        if (cc == '\n' && !quote) {
            ++row;
            col = 0;
            continue;
        }
        if (cc == '\r' && !quote) {
            ++row;
            col = 0;
            continue;
        }

        arr[row][col] += cc;
    }
    return arr;
};

const processCsvData = (text) => {
    const parsedRows = parseCSV(text);
    if (parsedRows.length === 0) return [];

    // Handle Headers & Normalization
    const rawHeaders = parsedRows[0].map(h => h.trim());

    // Schema Mapping (Normalize case-insensitive to expected keys)
    const schemaMap = {
        'id': 'id',
        'user': 'user',
        'chat': 'chat',
        'query': 'query',
        'model': 'model',
        'stage': 'stage',
        'status': 'status',
        'feedbackscore': 'feedbackScore',
        'feedback': 'feedbackScore', // Alias old feedback
        'date': 'date',
        'time': 'time',
        'retrycount': 'retryCount',
        'feedbackcomment': 'feedbackComment'
    };

    const headers = rawHeaders.map(h => schemaMap[h.toLowerCase()] || h);

    const newLogs = [];
    for (let i = 1; i < parsedRows.length; i++) {
        const values = parsedRows[i];
        if (values.length < headers.length) continue; // Skip empty/malformed

        const entry = {};
        headers.forEach((h, index) => {
            let val = values[index];
            if (val) val = val.trim();

            // Type conversion
            if (h === 'feedbackScore') val = (val === 'null' || val === '') ? null : Number(val);
            if (h === 'retryCount') val = Number(val);

            entry[h] = val;
        });
        // Basic validation: must have id or date
        if (entry.id || entry.date) {
            newLogs.push(entry);
        }
    }
    return newLogs;
};

// --- Reusable UI Components ---

const StatusBadge = ({ status }) => {
    const styles = {
        SUCCESS: 'bg-green-50 text-green-700 border-green-200',
        RUNNING: 'bg-blue-50 text-blue-700 border-blue-200',
        FAIL: 'bg-red-50 text-red-700 border-red-200',
        ERROR: 'bg-red-50 text-red-700 border-red-200',
        BLOCKED: 'bg-orange-50 text-orange-700 border-orange-200',
    };
    const labelMap = { SUCCESS: '성공', RUNNING: '운영 중', FAIL: '실패', ERROR: '에러', BLOCKED: '차단됨' };

    return (
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
            {labelMap[status] || status}
        </span>
    );
};

// 5점 만점 별점 컴포넌트
const StarRating = ({ rating }) => {
    if (rating === null || rating === undefined) return <span className="text-gray-300 text-xs">-</span>;

    return (
        <div className="flex items-center justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={`w-3 h-3 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                />
            ))}
        </div>
    );
};

const MetricCard = ({ title, value, unit, subtext, trend, icon, breakdown }) => {
    const Icon = iconMap[icon] || HelpCircle;
    const [isExpanded, setIsExpanded] = useState(false);

    const visibleItems = (breakdown && !isExpanded && breakdown.length > 3)
        ? breakdown.slice(0, 3)
        : breakdown;

    return (
        <div className="bg-white p-5 rounded-lg border border-gray-200 hover:border-indigo-200 transition-all shadow-sm">
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-gray-500 text-sm font-medium tracking-tight">{title}</h3>
                <div className={`p-2 rounded-lg ${trend === 'up' ? 'bg-green-50' : trend === 'down' ? 'bg-red-50' : 'bg-gray-50'}`}>
                    <Icon className={`w-4 h-4 ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-500'}`} />
                </div>
            </div>
            {breakdown ? (
                <div className="space-y-2 mt-2">
                    {visibleItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">{item.label}</span>
                            <div className="text-right">
                                <span className="font-bold text-gray-900">{item.value}</span>
                                {item.count && <span className="text-gray-400 text-xs ml-1">({item.count})</span>}
                            </div>
                        </div>
                    ))}
                    {breakdown.length > 3 && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-full flex items-center justify-center gap-1 mt-3 pt-2 border-t border-gray-100 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                            {isExpanded ? (
                                <>
                                    접기 <ChevronUp className="w-3 h-3" />
                                </>
                            ) : (
                                <>
                                    더 보기 ({breakdown.length - 3}개) <ChevronDown className="w-3 h-3" />
                                </>
                            )}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <div className="flex items-baseline gap-1 mb-1">
                        <span className="text-2xl font-bold text-gray-900 font-mono">{value}</span>
                        <span className="text-sm text-gray-500 font-medium">{unit}</span>
                    </div>
                    <div className="text-xs text-gray-400">{subtext}</div>
                </>
            )}
        </div>
    );
};

const ChartCard = ({ title, children, action }) => (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">{title}</h3>
            {action}
        </div>
        <div className="p-5 flex-1 min-h-[300px]">
            {children}
        </div>
    </div>
);

// --- Main Dashboard Layout ---

export default function TextToSqlDashboard() {

    // 기간 설정 상태 관리 (요청하신 기간 반영)
    const [dateRange, setDateRange] = useState({
        start: '2025-12-17',
        end: '2025-12-24'
    });
    // [New] 평점 필터 상태 관리 ('ALL', '5', '4', '1-3', 'NULL')
    const [filterRating, setFilterRating] = useState('ALL');
    // [New] 인피니티 스크롤을 위한 표시 개수 상태 관리
    const [displayCount, setDisplayCount] = useState(10);
    // [New] 인피니티 스크롤 관측 대상 Ref
    const observerTarget = useRef(null);
    // [New] File Uplod Ref
    const fileInputRef = useRef(null);
    // [New] Logs Data State (Initialized with Mock Data CSV)
    const [logs, setLogs] = useState(() => processCsvData(initialCsvData));
    // [New] Refresh Loading State
    const [isRefreshing, setIsRefreshing] = useState(false);
    // [New] Tooltip State
    const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: '' });

    const handleMouseEnter = (e, content) => {
        const rect = e.target.getBoundingClientRect();
        setTooltip({
            visible: true,
            x: rect.left + window.scrollX, // Just rect.left for fixed
            y: rect.bottom + window.scrollY, // Just rect.bottom for fixed
            rect: rect, // Store rect to compute precise fixed position
            content: content
        });
    };

    const handleMouseLeave = () => {
        setTooltip(prev => ({ ...prev, visible: false }));
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        // Simulate data fetch / Reset
        setTimeout(() => {
            setDateRange({ start: '2025-12-17', end: '2025-12-24' });
            setFilterRating('ALL');
            setDisplayCount(10);
            // Reset to default mock data on refresh? Or keep uploaded data?
            // User might expect refresh to reload "original" state or just re-fetch.
            // Let's keep current logs but reset filters.
            setIsRefreshing(false);
        }, 800);
    };

    // [New] Handle CSV Upload
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = evt.target.result;
            const newLogs = processCsvData(text);

            if (newLogs.length === 0) return;

            setLogs(newLogs);
            setDisplayCount(10);

            // Auto date range adjust logic
            if (newLogs.length > 0) {
                // Filter out invalid dates before sorting
                const validDates = newLogs
                    .map(l => l.date)
                    .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d))
                    .sort();

                if (validDates.length > 0) {
                    setDateRange({ start: validDates[0], end: validDates[validDates.length - 1] });
                }
            }
        };
        reader.readAsText(file);
    };

    // const { RECENT_LOGS } = mockData; // Removed and replaced by state


    // [Logic] Dynamic Data Calculation
    // 0. Base Data: Date Range Filtering (Inclusive)
    const rangeLogs = useMemo(() => {
        return logs.filter(log => {
            if (dateRange.start && log.date < dateRange.start) return false;
            if (dateRange.end && log.date > dateRange.end) return false;
            return true;
        }).sort((a, b) => {
            // 최신 날짜 순 정렬 (내림차순)
            if (b.date !== a.date) return b.date.localeCompare(a.date);
            // 같은 날짜면시간 순 정렬 (내림차순)
            return b.time.localeCompare(a.time);
        });
    }, [logs, dateRange]);

    // 1. KPI Calculation
    const KPI_METRICS = useMemo(() => {
        const totalRequests = rangeLogs.length;
        const uniqueUsers = new Set(rangeLogs.map(l => l.user)).size;
        const uniqueSessions = new Set(rangeLogs.map(l => l.chat)).size;

        // Model Usage
        const modelCounts = rangeLogs.reduce((acc, log) => {
            acc[log.model] = (acc[log.model] || 0) + 1;
            return acc;
        }, {});
        const modelBreakdown = Object.entries(modelCounts).map(([label, count]) => ({
            label,
            value: totalRequests ? `${Math.round((count / totalRequests) * 100)}%` : '0%',
            count: `${count}건`
        })).sort((a, b) => parseInt(b.count) - parseInt(a.count));

        // Retry Stats
        const retryLogs = rangeLogs.filter(l => l.retryCount > 0);
        const retryCounts = retryLogs.reduce((acc, log) => {
            acc[log.retryCount] = (acc[log.retryCount] || 0) + 1;
            return acc;
        }, {});
        const retryBreakdown = [1, 2, 3].map(cnt => ({
            label: `${cnt}회 재시도`,
            value: retryCounts[cnt] ? `${retryCounts[cnt]}건` : '0건',
            count: retryCounts[cnt] ? `${Math.round((retryCounts[cnt] / (retryLogs.length || 1)) * 100)}%` : '0%'
        }));

        // Avg Rating
        const ratedLogs = rangeLogs.filter(l => l.feedbackScore !== null);
        const avgRating = ratedLogs.length > 0
            ? (ratedLogs.reduce((sum, l) => sum + l.feedbackScore, 0) / ratedLogs.length).toFixed(1)
            : '0.0';

        return [
            { title: "활성 사용자", value: uniqueUsers.toLocaleString(), unit: "명", subtext: "기간 내 활동 사용자", trend: "neutral", icon: "User" },
            { title: "활성 세션", value: uniqueSessions.toLocaleString(), unit: "건", subtext: "기간 내 대화 세션", trend: "neutral", icon: "MessageSquare" },
            { title: "총 처리 질문 수", value: totalRequests.toLocaleString(), unit: "건", subtext: "기간 내 총 트래픽", trend: "neutral", icon: "HelpCircle" },
            { title: "모델별 사용 비율", breakdown: modelBreakdown, icon: "Cpu" },
            { title: "SQL 재시도 통계", breakdown: retryBreakdown, icon: "RefreshCw", value: retryLogs.length.toLocaleString(), unit: "건", subtext: "총 재시도 발생" },
            { title: "사용자 평균 평점", value: avgRating, unit: "/ 5.0", subtext: `총 ${ratedLogs.length}건 평가`, trend: "neutral", icon: "Star" }
        ];
    }, [rangeLogs]);

    // 2. Daily Stats Calculation
    const DAILY_STATS_DATA = useMemo(() => {
        if (!dateRange.start || !dateRange.end) return [];

        // Group actual log data by date
        const statsMap = rangeLogs.reduce((acc, log) => {
            const date = log.date; // YYYY-MM-DD
            if (!acc[date]) acc[date] = { request: 0, success: 0 };
            acc[date].request += 1;
            if (log.status === 'SUCCESS') acc[date].success += 1;
            return acc;
        }, {});

        // Generate all dates in range
        const result = [];
        const curDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);

        // Iterate inclusive
        while (curDate <= endDate) {
            const dateStr = curDate.toISOString().split('T')[0];
            const data = statsMap[dateStr] || { request: 0, success: 0 };

            result.push({
                date: dateStr.slice(5).replace('-', '.'), // 12.17
                request: data.request,
                successRate: data.request ? Math.round((data.success / data.request) * 100) : 0
            });

            curDate.setDate(curDate.getDate() + 1);
        }

        return result;
    }, [rangeLogs, dateRange]);

    // 3. Pipeline Funnel Calculation
    // Logic: Stage 5 implies passed 1,2,3,4. Stage 4 implies 1,2,3. etc.
    const PIPELINE_FUNNEL_DATA = useMemo(() => {
        const stages = [
            "1. 모델 상태 확인 (진입)",
            "2. 질문 분석 & 의도 파악",
            "3. 메타 정보(RAG) 조회",
            "4. SQL 생성 및 검증",
            "5. 결과 요약 (완료)"
        ];
        // Map log stage string to index
        const getStageIndex = (stageStr) => {
            const num = parseInt(stageStr.split('.')[0]);
            return num - 1; // 0-indexed
        };

        const counts = [0, 0, 0, 0, 0];
        rangeLogs.forEach(log => {
            const idx = getStageIndex(log.stage);
            // If log is at stage idx, it passed all stages up to idx (inclusive) IF it is SUCCESS or if it failed AT that stage.
            // Actually, Funnel usually shows how many ENTERED that stage.
            // If log is at Stage 3 (Failed), it entered 1, 2, 3.
            // If log is at Stage 5 (Success), it entered 1, 2, 3, 4, 5.
            if (idx >= 0) {
                for (let i = 0; i <= idx; i++) {
                    counts[i]++;
                }
            }
        });

        const palette = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"];
        return stages.map((stageName, i) => ({
            stage: stageName,
            count: counts[i],
            dropOff: (i < 4) ? (counts[i] - counts[i + 1]) : 0,
            fill: palette[i]
        }));
    }, [rangeLogs]);

    // 4. Error Distribution
    const ERROR_DISTRIBUTION = useMemo(() => {
        const errors = rangeLogs.filter(l => ['FAIL', 'ERROR', 'BLOCKED'].includes(l.status));
        const errorCounts = errors.reduce((acc, log) => {
            // Use Stage as Error Type proxy
            let reason = "기타 오류";
            if (log.stage.includes("메타")) reason = "메타 조회 실패";
            else if (log.stage.includes("SQL")) reason = "SQL 생성/검증 오류";
            else if (log.stage.includes("분석")) reason = "의도 파악 불가";
            else if (log.stage.includes("모델")) reason = "모델 연결 실패";
            else if (log.status === 'BLOCKED') reason = "정책 위반/차단";

            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
        }, {});

        const colors = ["#ef4444", "#f59e0b", "#8b5cf6", "#64748b", "#10b981"];
        return Object.entries(errorCounts).map(([name, value], idx) => ({
            name, value, color: colors[idx % colors.length]
        }));
    }, [rangeLogs]);



    // 평점 및 날짜 필터링 로직 (Table Use Only - already filtered by date in rangeLogs, but need to apply rating)
    const filteredLogs = rangeLogs.filter(log => {
        // 날짜 필터링 (Done in rangeLogs, but double check equality? No, rangeLogs is subset)
        // rangeLogs handles the date range logic.

        // 평점 필터링

        if (filterRating === 'ALL') return true;
        if (filterRating === 'NULL') return log.feedbackScore === null;
        if (filterRating === '5') return log.feedbackScore === 5;
        if (filterRating === '4') return log.feedbackScore === 4;
        if (filterRating === '1-3') return log.feedbackScore !== null && log.feedbackScore <= 3;
        return true;
    });

    // 날짜나 필터가 변경되면 displayCount 초기화


    // 인터섹션 옵저버 콜백 (스크롤이 바닥에 닿으면 더 로드)
    const handleObserver = useCallback((entries) => {
        const target = entries[0];
        if (target.isIntersecting) {
            setDisplayCount((prev) => prev + 10);
        }
    }, []);

    useEffect(() => {
        const option = {
            root: null,
            rootMargin: "20px",
            threshold: 0
        };
        const observer = new IntersectionObserver(handleObserver, option);
        const target = observerTarget.current;
        if (target) observer.observe(target);

        return () => {
            if (target) observer.unobserve(target);
        }
    }, [handleObserver, filteredLogs]); // filteredLogs가 바뀌면 타겟 위치가 바뀔 수 있으므로 의존성 추가 고려 (실제로는 displayCount 변경으로 리렌더링)

    const visibleLogs = filteredLogs.slice(0, displayCount);



    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

            {/* 2. 메인 콘텐츠 */}
            <main className="w-full max-w-7xl mx-auto min-w-0 pb-10">

                {/* 상단 헤더 - 카드 형태로 변경 */}
                <header className="bg-white rounded-xl border border-gray-200 shadow-sm mt-6 mx-6 lg:mx-8">
                    <div className="px-8 py-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <nav className="flex items-center text-sm text-gray-500 mb-1">
                                    <img src="/logo.png" alt="Logo" className="h-6 w-auto" />
                                </nav>
                                <div className="flex items-center gap-3 mt-2">
                                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">시범 서비스 결과 리포트</h1>
                                    <StatusBadge status="RUNNING" />
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {/* Row 1: 업로드 버튼 + 시범서비스 설정 버튼 */}
                                <div className="flex items-center gap-2">
                                    {/* [New] CSV Upload Button & Hidden Input */}
                                    <input
                                        type="file"
                                        accept=".csv"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleFileUpload}
                                        onClick={(e) => e.target.value = null} // Allow selecting same file again
                                    />
                                    <button
                                        onClick={() => {
                                            console.log('Upload clicked');
                                            fileInputRef.current?.click();
                                        }}
                                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                                        title="CSV 업로드"
                                    >
                                        <Download className="w-5 h-5 rotate-180" /> {/* Upload icon (rotated download) */}
                                    </button>

                                    <button
                                        onClick={handleRefresh}
                                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                        title="시범서비스 기간(12.17~12.24)으로 초기화"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                        시범서비스 기간으로 설정
                                    </button>
                                </div>

                                {/* Row 2: 기간 설정 UI (Bottom) */}
                                <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:border-indigo-300 transition-colors">
                                    <Calendar className="w-4 h-4 text-indigo-600" />
                                    <input
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => {
                                            setDateRange({ ...dateRange, start: e.target.value });
                                            setDisplayCount(10);
                                        }}
                                        className="border-none outline-none text-gray-700 p-0 w-[105px] bg-transparent text-sm cursor-pointer"
                                    />
                                    <span className="text-gray-400">~</span>
                                    <input
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => {
                                            setDateRange({ ...dateRange, end: e.target.value });
                                            setDisplayCount(10);
                                        }}
                                        className="border-none outline-none text-gray-700 p-0 w-[105px] bg-transparent text-sm cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* 콘텐츠 바디 */}
                <div className="p-8 space-y-6">

                    {/* 섹션 1: 주요 KPI (제공 데이터 기반) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {KPI_METRICS.map((kpi, idx) => (
                            <MetricCard key={idx} {...kpi} />
                        ))}
                    </div>

                    {/* 섹션 2: 차트 영역 (파이프라인 & 에러) */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* 파이프라인 퍼널 (요청하신 5단계) */}
                        <div className="lg:col-span-2">
                            <ChartCard
                                title={
                                    <>
                                        <Database className="w-4 h-4 text-indigo-500" />
                                        질문 처리 파이프라인
                                    </>
                                }
                            >
                                <div className="h-[320px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={PIPELINE_FUNNEL_DATA}
                                            layout="vertical"
                                            margin={{ top: 10, right: 30, left: 20, bottom: 5 }}
                                            barSize={32}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                            <XAxis type="number" hide />
                                            <YAxis
                                                dataKey="stage"
                                                type="category"
                                                width={180}
                                                tick={{ fontSize: 12, fill: '#4b5563', fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f3f4f6' }}
                                                contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                            />
                                            <Bar dataKey="count" radius={[0, 4, 4, 0]} background={{ fill: '#f9fafb' }}>
                                                {/* [New] 바 차트 값 표시 */}
                                                <LabelList dataKey="count" position="right" style={{ fontSize: '12px', fill: '#6b7280', fontWeight: 'bold' }} />
                                                {PIPELINE_FUNNEL_DATA.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        </div>

                        {/* 오류 분포 */}
                        <div className="lg:col-span-1">
                            <ChartCard title={
                                <>
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                    실패 원인 상세 분포
                                </>
                            }>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={ERROR_DISTRIBUTION}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            labelLine={false}
                                            label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, value }) => {
                                                // [New] 파이 차트 값 표시
                                                const RADIAN = Math.PI / 180;
                                                const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                                const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                const y = cy + radius * Math.sin(-midAngle * RADIAN);

                                                if (percent < 0.05) return null; // 너무 작은거 숨김

                                                return (
                                                    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
                                                        {value}
                                                    </text>
                                                );
                                            }}
                                        >
                                            {ERROR_DISTRIBUTION.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip />
                                        <Legend
                                            layout="horizontal"
                                            verticalAlign="bottom"
                                            align="center"
                                            iconSize={8}
                                            wrapperStyle={{ fontSize: '11px', paddingTop: '20px', fontWeight: 500 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </ChartCard>
                        </div>
                    </div>

                    {/* 섹션 3: 일별 트래픽 및 성공률 추이 */}
                    <ChartCard title={
                        <>
                            <TrendingUp className="w-4 h-4 text-indigo-500" />
                            일별 질문 요청 수 및 성공률 추이
                        </>
                    }>
                        <p className="text-xs text-gray-400 mb-2 text-right font-medium">* 막대: 요청 수 / 선: 성공률(%)</p>
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={DAILY_STATS_DATA} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <CartesianGrid stroke="#f5f5f5" vertical={false} />
                                <XAxis dataKey="date" scale="point" padding={{ left: 30, right: 30 }} tick={{ fontSize: 12, fill: '#666' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" axisLine={false} tickLine={false} />
                                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" unit="%" axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
                                <Bar yAxisId="left" dataKey="request" name="요청 수" barSize={30} fill="#818cf8" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="successRate" name="성공률" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    {/* 섹션 4: 상세 로그 테이블 (평점 필터링 기능 추가됨) */}
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                <List className="w-4 h-4 text-gray-500" />
                                일별 질문 처리 및 사용자 평점 로그
                            </h3>

                            {/* [New] 평점 필터 컨트롤 */}
                            <div className="flex items-center gap-2">
                                <Filter className="w-3 h-3 text-gray-500" />
                                <select
                                    value={filterRating}
                                    onChange={(e) => {
                                        setFilterRating(e.target.value);
                                        setDisplayCount(10);
                                    }}
                                    className="text-xs border-gray-300 rounded border px-2 py-1 bg-white text-gray-700 outline-none focus:border-indigo-500"
                                >
                                    <option value="ALL">전체 보기</option>
                                    <option value="5">★★★★★ (5점)</option>
                                    <option value="4">★★★★ (4점)</option>
                                    <option value="1-3">★★★ 이하 (1-3점)</option>
                                    <option value="NULL">평가 없음</option>
                                </select>
                            </div>
                        </div>
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-5 py-3 font-semibold">날짜</th>
                                        <th className="px-5 py-3 font-semibold">시간</th>
                                        <th className="px-5 py-3 font-semibold">사용자 / 채팅ID</th>
                                        <th className="px-5 py-3 font-semibold">질문 내용</th>
                                        <th className="px-5 py-3 font-semibold">모델</th>
                                        <th className="px-5 py-3 font-semibold">최종 단계</th>
                                        <th className="px-5 py-3 font-semibold">상태</th>
                                        <th className="px-5 py-3 font-semibold text-center">평점</th>
                                        <th className="px-5 py-3 font-semibold">코멘트</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visibleLogs.length > 0 ? (
                                        <>
                                            {visibleLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors align-top">
                                                    <td className="px-5 py-3 text-gray-500 text-xs font-mono whitespace-nowrap">{log.date.replace(/-/g, '. ')}</td>
                                                    <td className="px-5 py-3 text-gray-400 text-xs font-mono">{log.time}</td>
                                                    <td className="px-5 py-3">
                                                        <div className="font-medium text-gray-900 text-xs">{log.user}</div>
                                                        <div className="text-gray-400 text-[10px] font-mono">{log.chat}</div>
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-900 max-w-[200px] relative">
                                                        <div
                                                            className="truncate w-full cursor-help"
                                                            onMouseEnter={(e) => handleMouseEnter(e, log.query)}
                                                            onMouseLeave={handleMouseLeave}
                                                        >
                                                            {log.query}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                                                            {log.model}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-600 text-xs">{log.stage}</td>
                                                    <td className="px-5 py-3 text-gray-600 text-xs text-center align-middle">
                                                        <StatusBadge status={log.status} />
                                                        {log.retryCount > 0 && (
                                                            <div className="mt-1 flex items-center justify-center gap-0.5 text-[10px] text-orange-600 font-medium bg-orange-50 px-1.5 py-0.5 rounded-full inline-block">
                                                                <RefreshCw className="w-2.5 h-2.5" />
                                                                {log.retryCount}회 재시도
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        <StarRating rating={log.feedbackScore} />
                                                    </td>
                                                    <td className="px-5 py-3 text-xs text-gray-500 max-w-[150px] relative">
                                                        <div
                                                            className="truncate w-full cursor-help"
                                                            onMouseEnter={(e) => handleMouseEnter(e, log.feedbackComment || '-')}
                                                            onMouseLeave={handleMouseLeave}
                                                        >
                                                            {log.feedbackComment || '-'}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* 인피니티 스크롤 트리거 요소 */}
                                            {visibleLogs.length < filteredLogs.length && (
                                                <tr ref={observerTarget}>
                                                    <td colSpan="7" className="py-4 text-center text-xs text-gray-400">
                                                        Loading more...
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ) : (
                                        <tr>
                                            <td colSpan="8" className="px-5 py-8 text-center text-gray-500 text-xs">
                                                선택한 기간 또는 평점 조건에 해당하는 로그가 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>



                </div>
            </main>
            {/* Global Tooltip Portal (Rendered as fixed element) */}
            {tooltip.visible && (
                <div
                    className="fixed z-50 bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-xl max-w-sm whitespace-normal break-words pointer-events-none"
                    style={{
                        top: tooltip.rect.bottom + 5,
                        left: Math.max(10, Math.min(window.innerWidth - 300, tooltip.rect.left)) // Prevent going off-screen right
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
}
