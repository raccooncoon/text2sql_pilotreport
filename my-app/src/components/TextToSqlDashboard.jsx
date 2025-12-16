import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line
} from 'recharts';
import {
    Activity, Database, AlertTriangle, Clock,
    ArrowRight, List, Settings,
    ChevronRight, RefreshCw, Download, MoreHorizontal,
    Home, Box, BarChart2, User, MessageSquare, HelpCircle, Star, Calendar, TrendingUp, Filter, Cpu
} from 'lucide-react';
import mockData from '../data/mockData.json';

// Icon Mapping
const iconMap = {
    User: User,
    MessageSquare: MessageSquare,
    HelpCircle: HelpCircle,
    Star: Star,
    Cpu: Cpu
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
                    {breakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">{item.label}</span>
                            <div className="text-right">
                                <span className="font-bold text-gray-900">{item.value}</span>
                                {item.count && <span className="text-gray-400 text-xs ml-1">({item.count})</span>}
                            </div>
                        </div>
                    ))}
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
    const [mounted, setMounted] = useState(false);
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

    const { KPI_METRICS, DAILY_STATS_DATA, PIPELINE_FUNNEL_DATA, ERROR_DISTRIBUTION, RECENT_LOGS } = mockData;

    useEffect(() => {
        setMounted(true);
    }, []);

    // 평점 및 날짜 필터링 로직
    const filteredLogs = RECENT_LOGS.filter(log => {
        // 날짜 필터링 (Global Date Range 사용)
        if (dateRange.start && log.date < dateRange.start) return false;
        if (dateRange.end && log.date > dateRange.end) return false;

        // 평점 필터링
        if (filterRating === 'ALL') return true;
        if (filterRating === 'NULL') return log.feedback === null;
        if (filterRating === '5') return log.feedback === 5;
        if (filterRating === '4') return log.feedback === 4;
        if (filterRating === '1-3') return log.feedback !== null && log.feedback <= 3;
        return true;
    });

    // 날짜나 필터가 변경되면 displayCount 초기화
    useEffect(() => {
        setDisplayCount(10);
    }, [dateRange, filterRating]);

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
        if (observerTarget.current) observer.observe(observerTarget.current);

        return () => {
            if (observerTarget.current) observer.unobserve(observerTarget.current);
        }
    }, [handleObserver, filteredLogs]); // filteredLogs가 바뀌면 타겟 위치가 바뀔 수 있으므로 의존성 추가 고려 (실제로는 displayCount 변경으로 리렌더링)

    const visibleLogs = filteredLogs.slice(0, displayCount);

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-800">

            {/* 2. 메인 콘텐츠 (전체 너비 사용) */}
            <main className="w-full max-w-7xl mx-auto min-w-0">

                {/* 상단 헤더 */}
                <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                    <div className="px-8 py-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <nav className="flex items-center text-sm text-gray-500 mb-1">
                                    <span>서비스 관리</span>
                                    <ChevronRight className="w-4 h-4 mx-1" />
                                    <span className="text-gray-900 font-bold">Text-to-SQL Pilot v1.0</span>
                                </nav>
                                <div className="flex items-center gap-3 mt-2">
                                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">시범 서비스 결과 리포트</h1>
                                    <StatusBadge status="RUNNING" />
                                </div>
                            </div>
                            <div className="flex gap-2 items-center">

                                {/* [추가됨] 기간 설정 UI */}
                                <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 shadow-sm mr-2 hover:border-indigo-300 transition-colors">
                                    <Calendar className="w-4 h-4 text-indigo-600" />
                                    <input
                                        type="date"
                                        value={dateRange.start}
                                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                        className="border-none outline-none text-gray-700 p-0 w-[105px] bg-transparent text-sm cursor-pointer"
                                    />
                                    <span className="text-gray-400">~</span>
                                    <input
                                        type="date"
                                        value={dateRange.end}
                                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                        className="border-none outline-none text-gray-700 p-0 w-[105px] bg-transparent text-sm cursor-pointer"
                                    />
                                </div>

                                <button className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* 콘텐츠 바디 */}
                <div className="p-8 space-y-6">

                    {/* 섹션 1: 주요 KPI (제공 데이터 기반) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                                action={
                                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> 실시간
                                    </div>
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
                                    onChange={(e) => setFilterRating(e.target.value)}
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
                                        <th className="px-5 py-3 font-semibold text-center">평점 (5점)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {visibleLogs.length > 0 ? (
                                        <>
                                            {visibleLogs.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-5 py-3 text-gray-500 text-xs font-mono">{log.date.replace(/-/g, '. ')}</td>
                                                    <td className="px-5 py-3 text-gray-400 text-xs font-mono">{log.time}</td>
                                                    <td className="px-5 py-3">
                                                        <div className="font-medium text-gray-900 text-xs">{log.user}</div>
                                                        <div className="text-gray-400 text-[10px] font-mono">{log.chat}</div>
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-900 truncate max-w-[200px]" title={log.query}>
                                                        {log.query}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                                                            {log.model}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-600 text-xs">{log.stage}</td>
                                                    <td className="px-5 py-3">
                                                        <StatusBadge status={log.status} />
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        <StarRating rating={log.feedback} />
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
        </div>
    );
}
