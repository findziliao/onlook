export default function Layout({
    children,
}: Readonly<{ params: Promise<{ id: string }>; children: React.ReactNode }>) {
    // In pure local editing mode, we skip project access checks.
    return <>{children}</>;
}
