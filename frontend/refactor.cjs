const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src');

function mkdirP(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const moves = [
    ['store/store.ts', 'app/store.ts'],
    ['store/hooks.ts', 'app/hooks.ts'],
    ['App.tsx', 'app/App.tsx'],
    ['App.css', 'app/App.css'],
    ['api/axiosClient.ts', 'core/api/axiosClient.ts'],
    ['layouts/AdminLayout.tsx', 'components/layout/AdminLayout.tsx'],
    ['layouts/PublicLayout.tsx', 'components/layout/PublicLayout.tsx'],
    ['layouts/UserLayout.tsx', 'components/layout/UserLayout.tsx'],
    ['pages/admin/ExamBuilder.tsx', 'features/exams/pages/admin/ExamBuilder.tsx'],
    ['pages/admin/ExamBuilderPage.tsx', 'features/exams/pages/admin/ExamBuilderPage.tsx'],
    ['pages/admin/ExamManagement.tsx', 'features/exams/pages/admin/ExamManagement.tsx'],
    ['pages/student/ExamLibrary.tsx', 'features/exams/pages/student/ExamLibrary.tsx'],
    ['components/StudentExamView.tsx', 'features/exams/components/StudentExamView.tsx'],
    ['pages/student/TestHistory.tsx', 'features/history/pages/student/TestHistory.tsx'],
    ['pages/student/OnboardingPage.tsx', 'features/onboarding/pages/student/OnboardingPage.tsx'],
    ['components/AudioUploader.tsx', 'components/common/AudioUploader.tsx']
];

moves.forEach(([from, to]) => {
    const fromPath = path.join(src, from);
    const toPath = path.join(src, to);
    if (fs.existsSync(fromPath)) {
        mkdirP(path.dirname(toPath));
        fs.renameSync(fromPath, toPath);
        console.log(`Moved ${from} -> ${to}`);
    }
});

// Clean up empty dirs
['store', 'api', 'layouts', 'pages/admin', 'pages/student', 'pages'].forEach(d => {
    const p = path.join(src, d);
    if (fs.existsSync(p)) {
        try { fs.rmdirSync(p); } catch (e) {}
    }
});
