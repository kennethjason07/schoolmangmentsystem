#!/usr/bin/env python3
"""
VidyaSethu PNG Icon Generator
This script creates proper PNG icons with actual shapes for VidyaSethu features
"""

import os
import json
from PIL import Image, ImageDraw, ImageFont
import colorsys

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_academic_icon(size, color):
    """Create academic management (school building) icon"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # School building outline
    padding = size // 8
    width = size - 2 * padding
    height = size - 2 * padding
    
    # Main building
    building_height = height * 0.7
    building_width = width * 0.8
    building_x = padding + (width - building_width) // 2
    building_y = padding + (height - building_height)
    
    # Building base
    draw.rectangle([building_x, building_y, building_x + building_width, building_y + building_height], 
                  fill=color, outline=color)
    
    # Roof (triangle)
    roof_height = height * 0.3
    points = [
        (building_x + building_width // 2, padding),
        (building_x, building_y),
        (building_x + building_width, building_y)
    ]
    draw.polygon(points, fill=color)
    
    # Windows
    window_size = min(size // 10, 8)
    for i in range(2):
        for j in range(2):
            x = building_x + building_width * 0.2 + j * building_width * 0.6
            y = building_y + building_height * 0.2 + i * building_height * 0.3
            draw.rectangle([x, y, x + window_size, y + window_size], fill='white')
    
    return img

def create_attendance_icon(size, color):
    """Create attendance tracking (checkmark circle) icon"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    padding = size // 8
    center = size // 2
    radius = (size - 2 * padding) // 2
    
    # Circle
    draw.ellipse([center - radius, center - radius, center + radius, center + radius], 
                fill=color, outline=color)
    
    # Checkmark
    check_size = radius * 0.6
    check_points = [
        (center - check_size * 0.3, center),
        (center - check_size * 0.1, center + check_size * 0.3),
        (center + check_size * 0.4, center - check_size * 0.2)
    ]
    
    # Draw thick checkmark
    for i in range(len(check_points) - 1):
        draw.line([check_points[i], check_points[i + 1]], fill='white', width=max(2, size // 20))
    
    return img

def create_finance_icon(size, color):
    """Create finance & fees (card) icon"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    padding = size // 6
    card_width = size - 2 * padding
    card_height = card_width * 0.6
    card_x = padding
    card_y = (size - card_height) // 2
    
    # Card outline
    draw.rectangle([card_x, card_y, card_x + card_width, card_y + card_height], 
                  fill=color, outline=color)
    
    # Magnetic stripe
    stripe_height = card_height * 0.15
    draw.rectangle([card_x, card_y + card_height * 0.3, card_x + card_width, 
                   card_y + card_height * 0.3 + stripe_height], fill='white')
    
    # Chip
    chip_size = min(card_width * 0.15, card_height * 0.25)
    chip_x = card_x + card_width * 0.15
    chip_y = card_y + card_height * 0.6
    draw.rectangle([chip_x, chip_y, chip_x + chip_size, chip_y + chip_size], 
                  fill='white', outline='white')
    
    return img

def create_communication_icon(size, color):
    """Create communication (chat bubbles) icon"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    padding = size // 8
    bubble_size = (size - 2 * padding) // 2
    
    # First bubble (larger)
    x1, y1 = padding, padding
    draw.ellipse([x1, y1, x1 + bubble_size * 1.2, y1 + bubble_size], fill=color)
    
    # Second bubble (smaller, overlapping)
    x2, y2 = x1 + bubble_size * 0.6, y1 + bubble_size * 0.5
    draw.ellipse([x2, y2, x2 + bubble_size * 0.8, y2 + bubble_size * 0.8], fill=color)
    
    # Dots in first bubble
    dot_size = max(2, size // 25)
    for i in range(3):
        dot_x = x1 + bubble_size * 0.3 + i * bubble_size * 0.2
        dot_y = y1 + bubble_size * 0.4
        draw.ellipse([dot_x, dot_y, dot_x + dot_size, dot_y + dot_size], fill='white')
    
    return img

def create_reports_icon(size, color):
    """Create reports & analytics (bar chart) icon"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    padding = size // 6
    chart_width = size - 2 * padding
    chart_height = chart_width * 0.7
    base_y = padding + chart_height
    
    # Bar chart with 4 bars
    bar_width = chart_width // 5
    bar_spacing = bar_width // 4
    
    bar_heights = [0.3, 0.6, 0.9, 0.4]  # Relative heights
    
    for i, height_ratio in enumerate(bar_heights):
        bar_x = padding + i * (bar_width + bar_spacing)
        bar_height = chart_height * height_ratio
        bar_y = base_y - bar_height
        
        draw.rectangle([bar_x, bar_y, bar_x + bar_width, base_y], fill=color)
    
    # Axis lines
    axis_color = tuple(max(0, c - 50) for c in hex_to_rgb(color.lstrip('#')))
    draw.line([padding, base_y, padding + chart_width, base_y], fill=axis_color, width=2)
    draw.line([padding, base_y, padding, padding], fill=axis_color, width=2)
    
    return img

def create_administration_icon(size, color):
    """Create administration tools (people) icon"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    padding = size // 8
    person_width = (size - 2 * padding) // 3
    
    # Three people silhouettes
    for i in range(3):
        x = padding + i * person_width
        head_radius = person_width // 4
        head_y = padding + head_radius
        
        # Head
        draw.ellipse([x + person_width//4, head_y - head_radius, 
                     x + 3*person_width//4, head_y + head_radius], fill=color)
        
        # Body (simplified)
        body_y = head_y + head_radius
        body_height = (size - padding - body_y) * 0.8
        draw.ellipse([x, body_y, x + person_width, body_y + body_height], fill=color)
    
    return img

def create_mobile_icon(size, color):
    """Create mobile-friendly (phone) icon"""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    padding = size // 6
    phone_width = (size - 2 * padding) * 0.6
    phone_height = size - 2 * padding
    phone_x = (size - phone_width) // 2
    phone_y = padding
    
    # Phone outline
    draw.rounded_rectangle([phone_x, phone_y, phone_x + phone_width, phone_y + phone_height], 
                          radius=min(8, size//15), fill=color, outline=color)
    
    # Screen
    screen_padding = phone_width * 0.1
    screen_x = phone_x + screen_padding
    screen_y = phone_y + phone_height * 0.15
    screen_width = phone_width - 2 * screen_padding
    screen_height = phone_height * 0.7
    
    draw.rectangle([screen_x, screen_y, screen_x + screen_width, screen_y + screen_height], 
                  fill='white')
    
    # Home button
    button_radius = phone_width * 0.08
    button_x = phone_x + phone_width // 2
    button_y = phone_y + phone_height * 0.9
    draw.ellipse([button_x - button_radius, button_y - button_radius,
                 button_x + button_radius, button_y + button_radius], fill='white')
    
    return img

def create_icon_set():
    """Create complete VidyaSethu icon set"""
    
    # Icon definitions
    icons = [
        {
            'name': 'academic-management',
            'color': '#4CAF50',
            'creator': create_academic_icon,
            'feature': 'Academic Management'
        },
        {
            'name': 'attendance-tracking', 
            'color': '#4CAF50',
            'creator': create_attendance_icon,
            'feature': 'Attendance Tracking'
        },
        {
            'name': 'finance-fees',
            'color': '#2196F3', 
            'creator': create_finance_icon,
            'feature': 'Finance & Fees'
        },
        {
            'name': 'communication',
            'color': '#9C27B0',
            'creator': create_communication_icon, 
            'feature': 'Communication'
        },
        {
            'name': 'reports-analytics',
            'color': '#2196F3',
            'creator': create_reports_icon,
            'feature': 'Reports & Analytics'  
        },
        {
            'name': 'administration-tools',
            'color': '#2196F3',
            'creator': create_administration_icon,
            'feature': 'Administration Tools'
        },
        {
            'name': 'mobile-friendly',
            'color': '#2196F3', 
            'creator': create_mobile_icon,
            'feature': 'Mobile-Friendly'
        }
    ]
    
    sizes = [24, 32, 48, 64, 128, 256]
    output_dir = 'brochure-assets/icons/png-proper'
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    print("🎨 VidyaSethu PNG Icon Generator")
    print("===============================")
    print(f"📁 Output directory: {output_dir}")
    print(f"📏 Sizes: {', '.join(map(str, sizes))}px")
    print()
    
    created_files = []
    
    for icon in icons:
        print(f"🖼️  Creating: {icon['feature']}")
        
        for size in sizes:
            # Create the icon
            img = icon['creator'](size, icon['color'])
            
            # Save PNG
            filename = f"vidyasethu-{icon['name']}-{size}px.png"
            filepath = os.path.join(output_dir, filename)
            img.save(filepath, 'PNG', quality=100)
            
            created_files.append({
                'feature': icon['feature'],
                'filename': filename,
                'size': size,
                'color': icon['color']
            })
            
            print(f"  ✅ {filename}")
    
    # Create manifest
    manifest = {
        'meta': {
            'name': 'VidyaSethu Feature Icons (PNG)',
            'version': '1.0.0',
            'description': 'Proper PNG icons for VidyaSethu with actual shapes',
            'total_files': len(created_files),
            'formats': ['PNG'],
            'sizes': sizes
        },
        'icons': {}
    }
    
    # Group by feature
    for file_info in created_files:
        feature = file_info['feature']
        if feature not in manifest['icons']:
            manifest['icons'][feature] = {
                'color': file_info['color'],
                'files': []
            }
        manifest['icons'][feature]['files'].append({
            'size': file_info['size'],
            'filename': file_info['filename']
        })
    
    # Save manifest
    manifest_path = os.path.join(output_dir, 'png-icons-manifest.json')
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    print()
    print("🎉 PNG Generation Complete!")
    print(f"📊 Created {len(created_files)} PNG files")
    print(f"📄 Manifest: png-icons-manifest.json") 
    print(f"📂 All files saved to: {output_dir}")
    print()
    print("🚀 Professional PNG icons ready for your brochures!")

if __name__ == '__main__':
    create_icon_set()
