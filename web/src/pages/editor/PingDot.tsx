// Colored circle indicating connection quality based on round-trip ping latency.
// Green < 100ms, yellow 100–300ms, red > 300ms, gray = no measurement yet.

interface PingDotProps {
    pingMs: number | null;
}

export default function PingDot({ pingMs }: PingDotProps) {
    let color = "bg-gray-500"; // no data yet
    if (pingMs !== null) {
        if (pingMs < 100) color = "bg-green-400";
        else if (pingMs < 300) color = "bg-yellow-400";
        else color = "bg-red-400";
    }
    return <span className={`inline-block w-2 h-2 rounded-full ${color}`} />;
}
