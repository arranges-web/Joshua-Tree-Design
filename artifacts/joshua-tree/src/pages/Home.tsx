import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    window.location.replace("/admin/");
  }, []);

  return null;
}
