import { createContext } from "react";
//temporary muna
const id = "1";
let contUser;
fetch(`/api/user/${id}`)
  .then((res) => res.json())
  .then((data) => (contUser = data));

const user = createContext(contUser);
