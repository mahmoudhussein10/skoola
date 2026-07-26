export default function CourseLoading() {
  return (
    <main className="courseRouteLoading" dir="rtl" aria-busy="true" aria-label="جارٍ تحميل محتوى الكورس">
      <div className="courseLoadingHeader"><i /><span /></div>
      <div className="courseLoadingLayout"><section><i /><i /><i /></section><aside>{Array.from({ length: 6 }).map((_, index) => <i key={index} />)}</aside></div>
    </main>
  );
}