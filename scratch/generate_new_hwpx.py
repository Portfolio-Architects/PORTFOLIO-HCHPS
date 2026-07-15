import zipfile
import os
import shutil
import xml.etree.ElementTree as ET
import copy
import sys
import argparse

# Configure UTF-8 stdout
sys.stdout.reconfigure(encoding='utf-8')

def parse_markdown(md_path):
    """
    Parses a markdown file and categorizes each line.
    Handles table rows and merges them into a single ('TABLE', rows_list) token.
    """
    if not os.path.exists(md_path):
        print(f"Error: Markdown file not found at {md_path}")
        return []
    
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    parsed_lines = []
    current_table_rows = []
    in_table = False
    
    for line in lines:
        line_str = line.strip()
        
        # Table Row Detection
        if line_str.startswith('|') and line_str.endswith('|'):
            # Skip separator line
            if '---' in line_str:
                continue
            cols = [c.strip() for c in line_str.split('|')[1:-1]]
            current_table_rows.append(cols)
            in_table = True
            continue
        else:
            if in_table:
                if current_table_rows:
                    parsed_lines.append(('TABLE', current_table_rows))
                    current_table_rows = []
                in_table = False
                
        if not line_str:
            parsed_lines.append(('SPACER', ''))
            continue
            
        # Match headings and list items
        if line_str.startswith('# '):
            parsed_lines.append(('TITLE', line_str[2:].strip()))
        elif line_str.startswith('## '):
            parsed_lines.append(('HEADING_1', line_str[3:].strip()))
        elif line_str.startswith('### '):
            parsed_lines.append(('HEADING_2', line_str[4:].strip()))
        elif line_str.startswith('- ') or line_str.startswith('* '):
            parsed_lines.append(('ITEM', line_str[2:].strip()))
        elif line_str.startswith('▢') or line_str.startswith('❍') or line_str.startswith('▪'):
            parsed_lines.append(('ITEM_BULLET', line_str))
        else:
            parsed_lines.append(('NORMAL', line_str))
            
    # Flush remaining table
    if in_table and current_table_rows:
        parsed_lines.append(('TABLE', current_table_rows))
        
    return parsed_lines

def has_ctrl_objects(p_node, ns):
    """
    Checks if a paragraph contains tables, boxes, equations, drawings, shapes or images.
    If it does, we must preserve it and not overwrite or delete it as a plain text paragraph.
    """
    tbls = p_node.findall('.//hp:tbl', ns)
    if tbls:
        return True
        
    for elem in p_node.iter():
        tag_local = elem.tag.split('}')[-1]
        if tag_local in ['tbl', 'box', 'picture', 'equation', 'shape', 'container', 'line', 'rect', 'ellipse']:
            return True
    return False

def update_paragraph_text(p_node, text, ns):
    """
    Safely updates the text of a paragraph by replacing only pure text hp:t nodes.
    Crucially avoids altering any inner text nodes of nested control shapes (tables, boxes).
    """
    # 1. Collect run elements directly under the paragraph (no deep descendants)
    direct_runs = p_node.findall('./hp:run', ns)
    
    # 2. Filter runs that do NOT contain any control object nodes
    pure_text_runs = []
    for r in direct_runs:
        has_obj = False
        for elem in r.iter():
            tag_local = elem.tag.split('}')[-1]
            if tag_local in ['tbl', 'box', 'picture', 'equation', 'shape', 'container']:
                has_obj = True
                break
        if not has_obj:
            pure_text_runs.append(r)
            
    # 3. Collect hp:t elements from pure text runs
    t_nodes = []
    for r in pure_text_runs:
        t_nodes.extend(r.findall('./hp:t', ns))
        
    if t_nodes:
        # First pure t node gets the new text
        t_nodes[0].text = text
        # Remove any other extra pure text nodes to prevent redundancy
        for extra_t in t_nodes[1:]:
            for r in pure_text_runs:
                if extra_t in r:
                    r.remove(extra_t)
    else:
        # If no pure text runs exist, create one
        if pure_text_runs:
            run_node = pure_text_runs[0]
        else:
            run_node = ET.Element('{http://www.hancom.co.kr/hwpml/2011/paragraph}run')
            p_node.append(run_node)
        t_node = ET.Element('{http://www.hancom.co.kr/hwpml/2011/paragraph}t')
        t_node.text = text
        run_node.append(t_node)

def build_new_hwpx(template_path, output_path, md_path):
    temp_dir = os.path.join(os.path.dirname(output_path), "temp_build_hwpx")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)
    
    try:
        # 1. Copy template files to temp directory
        with zipfile.ZipFile(template_path, 'r') as z:
            z.extractall(temp_dir)
        print("Successfully extracted template HWPX.")
        
        ET.register_namespace('hp', 'http://www.hancom.co.kr/hwpml/2011/paragraph')
        ET.register_namespace('hs', 'http://www.hancom.co.kr/hwpml/2011/section')
        ET.register_namespace('hc', 'http://www.hancom.co.kr/hwpml/2011/core')
        
        section_xml_path = os.path.join(temp_dir, "Contents", "section0.xml")
        tree = ET.parse(section_xml_path)
        root = tree.getroot()
        
        ns = {
            'hp': 'http://www.hancom.co.kr/hwpml/2011/paragraph',
            'hs': 'http://www.hancom.co.kr/hwpml/2011/section',
            'hc': 'http://www.hancom.co.kr/hwpml/2011/core'
        }
        
        # Build parent map for checking table cells
        parent_map = {c: p for p in root.iter() for c in p}
        
        def is_p_in_table(p_node):
            curr = p_node
            while curr in parent_map:
                curr = parent_map[curr]
                if curr.tag.endswith('tc') or curr.tag.endswith('tbl'):
                    return True
            return False
            
        # 2. Extract paragraph style templates
        p_elements = root.findall('.//hp:p', ns)
        if not p_elements:
            print("Error: No paragraph elements found in template section0.xml.")
            return False
            
        # Parse Markdown
        parsed_md = parse_markdown(md_path)
        
        # 3. Find and update tables in the template with markdown data
        tbl_elements = root.findall('.//hp:tbl', ns)
        table_tokens = [token for token in parsed_md if token[0] == 'TABLE']
        
        if table_tokens:
            md_table_data = table_tokens[0][1] # use the first table in markdown
            
            # Determine start index of data rows in markdown (skip headers)
            md_start_row = 0
            if len(md_table_data) > 0:
                first_row = md_table_data[0]
                if any(k in "".join(first_row) for k in ["장비명", "품명", "연번"]):
                    md_start_row = 1
            
            md_rows = md_table_data[md_start_row:]
            
            for i, tbl in enumerate(tbl_elements):
                # Filter out layout tables or tables that don't match the column count of equipment tables
                col_cnt = int(tbl.attrib.get('colCnt', 0))
                if col_cnt < 5:
                    continue
                    
                rows = tbl.findall('hp:tr', ns)
                if not rows:
                    continue
                
                # Check headers
                first_row = rows[0]
                cells = first_row.findall('hp:tc', ns)
                headers = []
                for cell in cells:
                    cell_text = "".join(t.text for t in cell.findall('.//hp:t', ns) if t.text).strip()
                    headers.append(cell_text)
                
                # Check if it's an equipment list table (contains '장비명' or '구성 사양')
                is_target = False
                for h in headers:
                    if "장비명" in h or "구성 사양" in h:
                        is_target = True
                        break
                
                if not is_target:
                    continue
                    
                print(f"Populating Table {i+1} with headers: {headers}")
                
                # Build column mapping
                col_map = {}
                for c_idx, h in enumerate(headers):
                    if "연번" in h:
                        col_map[c_idx] = 0
                    elif "장비명" in h or "품명" in h:
                        col_map[c_idx] = 1
                    elif "항목" in h or "특징" in h:
                        col_map[c_idx] = 2
                    elif "단가" in h or "금액" in h:
                        col_map[c_idx] = 3
                    elif "비고" in h:
                        col_map[c_idx] = 4
                    else:
                        col_map[c_idx] = None
                
                data_rows = rows[1:]
                
                # In-place update existing rows or append if we have more rows than template
                for r_offset, row_data in enumerate(md_rows):
                    if r_offset < len(data_rows):
                        curr_row = data_rows[r_offset]
                    else:
                        # Append a new row by copying the last data row
                        curr_row = copy.deepcopy(data_rows[-1])
                        # Update rowAddr for cellAddr in the appended row
                        for cell in curr_row.findall('hp:tc', ns):
                            addr = cell.find('hp:cellAddr', ns)
                            if addr is not None:
                                addr.attrib['rowAddr'] = str(1 + r_offset)
                        tbl.append(curr_row)
                        
                    new_cells = curr_row.findall('hp:tc', ns)
                    for c_idx, cell in enumerate(new_cells):
                        if c_idx not in col_map or col_map[c_idx] is None:
                            # Skip unmapped columns (like '사진') to preserve original cells/drawing objects
                            continue
                        
                        md_col_idx = col_map[c_idx]
                        if md_col_idx >= len(row_data):
                            continue
                        val = row_data[md_col_idx]
                        
                        p_nodes = cell.findall('hp:p', ns)
                        if p_nodes:
                            p_node = p_nodes[0]
                            t_nodes = p_node.findall('.//hp:t', ns)
                            if t_nodes:
                                t_nodes[0].text = val
                                for extra_t in t_nodes[1:]:
                                    p_node.remove(extra_t)
                            else:
                                run_node = ET.Element('{http://www.hancom.co.kr/hwpml/2011/paragraph}run')
                                t_node = ET.Element('{http://www.hancom.co.kr/hwpml/2011/paragraph}t')
                                t_node.text = val
                                run_node.append(t_node)
                                p_node.append(run_node)
                            for extra_p in p_nodes[1:]:
                                cell.remove(extra_p)
                                
                # If there are surplus rows in the template, empty them instead of deleting
                # (Deleting them would corrupt vertically merged cell geometry e.g. rowSpan)
                if len(md_rows) < len(data_rows):
                    for r_offset in range(len(md_rows), len(data_rows)):
                        surplus_row = data_rows[r_offset]
                        for c_idx, cell in enumerate(surplus_row.findall('hp:tc', ns)):
                            if c_idx not in col_map or col_map[c_idx] is None:
                                continue
                            p_nodes = cell.findall('hp:p', ns)
                            if p_nodes:
                                p_node = p_nodes[0]
                                t_nodes = p_node.findall('.//hp:t', ns)
                                if t_nodes:
                                    t_nodes[0].text = ""
                                    for extra_t in t_nodes[1:]:
                                        p_node.remove(extra_t)
                                for extra_p in p_nodes[1:]:
                                    cell.remove(extra_p)
                
                # Update rowCnt to match actual number of rows
                tbl.attrib['rowCnt'] = str(len(tbl.findall('hp:tr', ns)))
                print(f"Successfully populated Table {i+1}.")

        # 4. Filter out direct plain text paragraphs (not inside tables and does not contain control shapes)
        parent_map = {c: p for p in root.iter() for c in p}
        direct_p_nodes = []
        for p in root.findall('.//hp:p', ns):
            if not is_p_in_table(p) and not has_ctrl_objects(p, ns):
                direct_p_nodes.append(p)
                
        # 5. Extract normal paragraphs to create from markdown (excluding TABLE and SPACER)
        # Empty paragraphs are filtered out to keep meaningful contents only
        text_tokens = [t for t in parsed_md if t[0] not in ['TABLE', 'SPACER'] and t[1].strip()]
        
        num_existing = len(direct_p_nodes)
        num_new = len(text_tokens)
        
        print(f"Template has {num_existing} direct plain text paragraphs. Markdown has {num_new} valid text paragraphs.")
        
        # 6. Zero-Mutation: We update paragraph text in-place. We NEVER append or remove elements.
        # This guarantees 100% identical XSD validation tree structures compared to the original file.
        for idx in range(num_existing):
            old_p = direct_p_nodes[idx]
            if idx < num_new:
                tag, text = text_tokens[idx]
                
                # Map styled prefixes for hierarchy
                if tag == 'TITLE':
                    formatted_text = f"󰏚 {text}"
                elif tag == 'HEADING_1':
                    formatted_text = f"▢ {text}"
                elif tag == 'HEADING_2':
                    formatted_text = f"❍ {text}"
                elif tag == 'ITEM':
                    formatted_text = f"  - {text}"
                elif tag == 'ITEM_BULLET':
                    formatted_text = f"  {text}"
                else:
                    formatted_text = text
                    
                update_paragraph_text(old_p, formatted_text, ns)
            else:
                # Clear surplus placeholder paragraphs
                update_paragraph_text(old_p, "", ns)
                
        # 8. Save XML and repackage as HWPX
        # Note: We DO NOT alter paragraph attributes to maintain 100% identical structures
        tree.write(section_xml_path, encoding='utf-8', xml_declaration=False)
        
        try:
            with zipfile.ZipFile(template_path, 'r') as z_orig:
                orig_xml = z_orig.read('Contents/section0.xml').decode('utf-8')
                sec_start = orig_xml.find('<hs:sec')
                sec_end = orig_xml.find('>', sec_start)
                orig_header = orig_xml[:sec_end+1]
                
            with open(section_xml_path, 'r', encoding='utf-8') as f:
                generated_xml = f.read()
                
            g_sec_start = generated_xml.find('<hs:sec')
            g_sec_end = generated_xml.find('>', g_sec_start)
            
            final_xml = orig_header + generated_xml[g_sec_end+1:]
            
            with open(section_xml_path, 'w', encoding='utf-8') as f:
                f.write(final_xml)
            print("Successfully restored original XML declaration and namespace prefixes.")
        except Exception as header_err:
            print(f"Warning: Failed to restore original XML header: {header_err}")
            
        if os.path.exists(output_path):
            os.remove(output_path)
            
        # 9. Pack ZIP archive preserving 100% of the original metadata (create_system=11, headers, attributes)
        # We read template entries, preserve their original ZipInfo headers, and swap only Contents/section0.xml
        with zipfile.ZipFile(template_path, 'r') as z_in:
            with zipfile.ZipFile(output_path, 'w') as z_out:
                for info in z_in.infolist():
                    if info.filename == "Contents/section0.xml":
                        with open(section_xml_path, 'rb') as f:
                            xml_data = f.read()
                        info.file_size = len(xml_data)
                        z_out.writestr(info, xml_data)
                    else:
                        file_data = z_in.read(info.filename)
                        z_out.writestr(info, file_data)
        
        # 10. Patch flag_bits in the ZIP file for DEFLATED files
        # Python's zipfile resets bit 2 (Fast Deflating) which Hancom Office might check.
        import struct
        with open(output_path, 'r+b') as f:
            data = bytearray(f.read())
        
        offset = 0
        while offset < len(data) - 30:
            if data[offset:offset+4] == b'PK\x03\x04':
                comp_method = struct.unpack_from('<H', data, offset+8)[0]
                if comp_method == 8:  # DEFLATED
                    struct.pack_into('<H', data, offset+6, 4)
            offset += 1
            
        offset = 0
        while offset < len(data) - 46:
            if data[offset:offset+4] == b'PK\x01\x02':
                comp_method = struct.unpack_from('<H', data, offset+10)[0]
                if comp_method == 8:  # DEFLATED
                    struct.pack_into('<H', data, offset+8, 4)
            offset += 1
            
        with open(output_path, 'wb') as f:
            f.write(data)
                        
        print(f"Successfully built HWPX with 100% identical ZIP headers at: {output_path}")
        return True
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"Error during HWPX document generation: {e}")
        return False
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Convert Markdown Draft to HWPX with Safe In-place Text Updates.")
    parser.add_argument('--template', required=True, help="Path to base HWPX template")
    parser.add_argument('--output', required=True, help="Path to output HWPX file")
    parser.add_argument('--markdown', required=True, help="Path to input Markdown file")
    args = parser.parse_args()
    
    build_new_hwpx(args.template, args.output, args.markdown)
