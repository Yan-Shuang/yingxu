import { Suspense } from "react";
import AuthForm from "@/components/product/AuthForm";
export default function Login() {
  return (
    <Suspense fallback={<div className="yx-loading">加载中…</div>}>
      <AuthForm />
    </Suspense>
  );
}
