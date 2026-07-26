export default function TeacherLoading() {
  return (
    <main className="teacherRouteLoading" dir="rtl" aria-busy="true" aria-label="جارٍ تحميل لوحة المدرس">
      <div className="teacherLoadingTop"><i /><span /></div>
      <div className="teacherLoadingHero"><i /><i /><i /></div>
      <div className="teacherLoadingKpis">{Array.from({ length: 6 }).map((_, index) => <i key={index} />)}</div>
      <div className="teacherLoadingPanels"><i /><i /></div>
    </main>
  );
}