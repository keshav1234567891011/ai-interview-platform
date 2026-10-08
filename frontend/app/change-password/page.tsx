import { AuthGuard } from "@/components/auth/auth-guard";
import { ChangePassword } from "@/components/auth/change-password";
import { Header } from "@/components/layout/header";
import { Container } from "@/components/layout/container";
export default function Page() { return <><Header /><main id="main-content" tabIndex={-1}><Container><AuthGuard><ChangePassword /></AuthGuard></Container></main></>; }
