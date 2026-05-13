export async function renderHtml(env: Env, content: string) {
    // Fetch the HTML template from assets
    const response = await env.ASSETS.fetch('index.html');
    let html = await response.text();
    
    // Replace placeholder with actual data
    html = html.replace('{{content}}', content);
    
    return html;
}