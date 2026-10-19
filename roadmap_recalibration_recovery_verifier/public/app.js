const root = document.documentElement;
const stored = localStorage.getItem("prodmind-theme");
if (stored) root.dataset.theme = stored;
document.querySelector("#theme").addEventListener("click", () => {
  const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  root.dataset.theme = current === "dark" ? "light" : "dark";
  localStorage.setItem("prodmind-theme", root.dataset.theme);
});
document.querySelector("#run").addEventListener("click", async () => {
  const result = document.querySelector("#result");
  result.textContent = "Verifying…";
  try {
    const response = await fetch("/api/roadmap-recalibration-recovery", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${document.querySelector("#token").value}`,
        "Content-Type": "application/json",
      },
      body: document.querySelector("#payload").value,
    });
    result.textContent = JSON.stringify(await response.json(), null, 2);
  } catch (error) {
    result.textContent = error.message;
  }
});

