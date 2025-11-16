export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
    // In pure local editing mode, we bypass Supabase auth and subscription checks
    // and always render the project shell.
    return <>{children}</>;
}
