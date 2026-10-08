import { Suspense } from "react";
import NewProject from "@/components/product/NewProject";
export default function New() {
  return (
    <Suspense fallback={<div className="yx-loading">加载创作空间…</div>}>
      <NewProject />
    </Suspense>
  );
}
