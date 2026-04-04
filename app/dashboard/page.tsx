"use client";

import { useEffect, useState } from "react";
import { User } from "../generated/prisma/client";

export default function Dashboard() {
  //temporary muna
  const id = "1";
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/user/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setUser(data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>No user found.</p>;
  return (
    <div>
      <h1>Welcome, {user.name}!</h1>
    </div>
  );
}
