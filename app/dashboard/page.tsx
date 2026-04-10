"use client";

import { useEffect, useState } from "react";

import { useUser } from "../hooks/useUser";
import { logout } from "../login/actions";

export default function Dashboard() {
  const { user, setUser } = useUser();
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch(`/api/me`)
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>No user found.</p>;
  return (
    <>
      <div>
        <h1>Welcome, {user.name}!</h1>
      </div>
      <form action={logout}>
        <button type="submit">logout</button>
      </form>
    </>
  );
}
