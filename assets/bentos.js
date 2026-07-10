window.BentoWallet = {
  async refresh(sb, userId) {
    const el = document.getElementById("bentoBalance");

    try {
      const result = await sb.rpc("get_my_bento_balance");

      if (result.error) {
        throw result.error;
      }

      if (el) {
        el.textContent = Number(result.data || 0).toLocaleString("pt-BR");
      }
    } catch (error) {
      console.warn("Bento balance unavailable:", error.message);

      if (el) {
        el.textContent = "0";
      }
    }
  }
};
