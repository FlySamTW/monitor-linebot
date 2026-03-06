import streamlit as st
from markitdown import MarkItDown
import os
import tempfile

st.set_page_config(page_title="PDF to Markdown Converter", page_icon="📄")

st.title("📄 PDF to Markdown Converter (Markitdown)")
st.write("Upload PDF files to precisely convert them to LLM-friendly structural Markdown.")
st.write("這將使用微軟開源工具 `markitdown` 來保留您的表格、邏輯標題與結構，藉此解決 RAG 容易錯亂的問題。請選擇轉換後獲得的 `.md` 並上傳至雲端知識庫。")

uploaded_files = st.file_uploader("選擇多行 PDF 說明書", type=["pdf", "docx", "xlsx"], accept_multiple_files=True)

if uploaded_files:
    if st.button("開始轉檔成 Markdown"):
        md_util = MarkItDown()
        
        for idx, uploaded_file in enumerate(uploaded_files):
            st.write(f"正在轉換: **{uploaded_file.name}**...")
            with st.spinner("Processing..."):
                try:
                    # Save uploaded file to temp file
                    ext = "." + uploaded_file.name.split(".")[-1]
                    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
                        tmp.write(uploaded_file.getvalue())
                        tmp_path = tmp.name
                    
                    # Convert using markitdown
                    result = md_util.convert(tmp_path)
                    markdown_text = result.text_content
                    
                    # Create downloadable filename
                    out_filename = uploaded_file.name.replace(ext, ".md")
                    
                    st.success(f"✅ 轉換完成: {out_filename} (字元數: {len(markdown_text)})")
                    st.download_button(
                        label=f"⬇️ 下載 {out_filename}",
                        data=markdown_text,
                        file_name=out_filename,
                        mime="text/markdown",
                        key=f"download_{idx}"
                    )
                    
                    # Cleanup
                    os.unlink(tmp_path)
                except Exception as e:
                    st.error(f"轉換發生錯誤 {uploaded_file.name}: {e}")
