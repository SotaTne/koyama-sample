import Link from "next/link";

export default function Page() {
  return (
    <div>
      <Link href="/out-camera">
        Go to Out Camera
      </Link>
      <Link href="/out-camera-config">
        Go to Out Camera Config
      </Link>
    </div>
  )
}