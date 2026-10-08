import { Suspense } from "react";
import AuthForm from "@/components/product/AuthForm";
export default function Register() {
  return (
    <Suspense fallback={<div className="yx-loading">加载中…</div>}>
      <AuthForm register />
    </Suspense>
  );
}
