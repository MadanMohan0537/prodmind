const root = document.documentElement;
const theme = document.querySelector("#theme");
const stored = localStorage.getItem("prodmind-theme");
if (stored) root.dataset.theme = stored;

theme.addEventListener("click", () => {
  const current = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  root.dataset.theme = current === "dark" ? "light" : "dark";
  localStorage.setItem("prodmind-theme", root.dataset.theme);
});

document.querySelector("#run").addEventListener("click", async () => {
  const result = document.querySelector("#result");
  result.textContent = "Evaluating…";
  try {
    const response = await fetch("/api/roadmap-recalibration-rollout", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${document.querySelector("#token").value}`,
        "Content-Type": "application/json",
      },
      body: document.querySelector("#payload").value,
    });
    const body = await response.json();
    result.textContent = JSON.stringify(body, null, 2);
  } catch (error) {
    result.textContent = error.message;
  }
});

