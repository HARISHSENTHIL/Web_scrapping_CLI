import streamlit as st
from crawl4ai import WebCrawler
import base64

def download_markdown(content, filename="extracted_content.md"):
      # Encode the content as base64
    b64 = base64.b64encode(content.encode()).decode()
    href = f'<a href="data:file/markdown;base64,{b64}" download="{filename}">Download Markdown File</a>'
    return href

def main():
    st.title("Crawl4AI Web Scraper")

    url = st.text_input("Enter the URL you want to scrape:")

    if st.button("Run Crawl"):
        if url:
            crawler = WebCrawler()
            crawler.warmup()

            result = crawler.run(url=url)
            st.markdown(result.markdown)

            st.markdown(download_markdown(result.markdown), unsafe_allow_html=True)
        else:
            st.warning("Please enter a valid URL.")

if __name__ == "__main__":
    main()