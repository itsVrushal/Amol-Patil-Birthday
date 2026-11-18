#!/usr/bin/env python3
"""
Full Reprocessor & Config Generator
===================================
Processes all 100 images, generates cutouts, extracts dates,
creates 99 bilingual slides, and updates config.json.
"""

import os, sys, re, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps
import pillow_heif
import onnxruntime as ort
from tqdm import tqdm

pillow_heif.register_heif_opener()

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "img_Dir"
ORIG_OUT = ROOT / "public" / "images" / "originals"
CUT_OUT = ROOT / "public" / "images" / "cutouts"
CONFIG_FILE = ROOT / "config.json"
MODEL_PATH = ROOT / "models" / "rmbg-1.4.onnx"

ORIG_OUT.mkdir(parents=True, exist_ok=True)
CUT_OUT.mkdir(parents=True, exist_ok=True)

def sort_key(name):
    base = os.path.splitext(name)[0]
    parts = base.split('.')
    return [float(p) if re.match(r'^\d+(\.\d+)?$', p) else p for p in parts]

def get_sorted_images():
    files = [f for f in os.listdir(IMG_DIR) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
    return sorted(files, key=sort_key)

def get_exif_year(img_path):
    try:
        with Image.open(img_path) as im:
            exif = im._getexif() or {}
            date_str = exif.get(36867, exif.get(306, ''))
            if date_str:
                m = re.match(r'^(\d{4})', str(date_str))
                if m:
                    return m.group(1)
    except Exception:
        pass
    return None

INPUT_SIZE = 1024

def preprocess(img: Image.Image) -> np.ndarray:
    img = img.convert("RGB").resize((INPUT_SIZE, INPUT_SIZE), Image.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0
    arr = (arr - 0.5) / 1.0
    arr = arr.transpose(2, 0, 1).astype(np.float32)
    return arr[np.newaxis, :].astype(np.float32)

def postprocess(pred: np.ndarray, orig_size: tuple) -> Image.Image:
    mask = pred[0, 0]
    mask = np.clip(mask, 0.0, 1.0)
    mask_u8 = (mask * 255).astype(np.uint8)
    return Image.fromarray(mask_u8).resize(orig_size, Image.BILINEAR)

def process_image(src_path: Path, session: ort.InferenceSession):
    stem = src_path.stem
    orig_dest = ORIG_OUT / f"{stem}.jpg"
    cutout_dest = CUT_OUT / f"{stem}_cutout.png"

    try:
        img = Image.open(src_path)
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        if max(img.size) > 1920:
            img.thumbnail((1920, 1920), Image.LANCZOS)

        img.convert("RGB").save(str(orig_dest), "JPEG", quality=86, optimize=True)

        orig_rgb = img.convert("RGB")
        w, h = orig_rgb.size
        inp = preprocess(orig_rgb)
        out = session.run(None, {session.get_inputs()[0].name: inp})
        mask = postprocess(out[0], (w, h))

        rgba = orig_rgb.convert("RGBA")
        rgba.putalpha(mask)
        rgba.save(str(cutout_dest), "PNG", optimize=True)

        mask_arr = np.array(mask)
        non_zeros = np.where(mask_arr > 30)
        if len(non_zeros[1]) > 0:
            center_x = float(non_zeros[1].mean() / w)
        else:
            center_x = 0.5

        return center_x
    except Exception as e:
        print(f"⚠️ Error processing {src_path.name}: {e}")
        return 0.5

# ── 99 Chronological Thematic Titles & Captions ─────────────────────────────
STORY_DATA = [
    # 1 - 10: Early beginnings, roots, youth
    {"title": {"en": "The Golden Dawn", "mr": "सुवर्ण पहाट"}, "caption": {"en": "Every great journey starts with a quiet, humble dawn.", "mr": "प्रत्येक महान प्रवासाची सुरुवात एका शांत आणि साध्या पहाटेने होते."}},
    {"title": {"en": "Youthful Spirit", "mr": "तरुण मन"}, "caption": {"en": "Eyes filled with dreams, heart ready for the world.", "mr": "डोळ्यांत स्वप्ने आणि जगाला सामोरे जाण्याची जिद्द."}},
    {"title": {"en": "Rooted in Faith", "mr": "श्रद्धेची मुळे"}, "caption": {"en": "Strong roots withstand the fiercest winds.", "mr": "मजबूत मुळे वादळातही पाय घट्ट रोवून उभी राहतात."}},
    {"title": {"en": "Simpler Days", "mr": "साधे दिवस"}, "caption": {"en": "When happiness was found in life's smallest moments.", "mr": "जेव्हा छोट्या छोट्या गोष्टींतच खरा आनंद सामावलेला होता."}},
    {"title": {"en": "The Quiet Thinker", "mr": "शांत विचार"}, "caption": {"en": "A calm mind observes what words often miss.", "mr": "शांत मन नेहमी शब्दांपलीकडचे सत्य जाणते."}},
    {"title": {"en": "Stepping Forward", "mr": "पुढील पाऊल"}, "caption": {"en": "Courage isn't loud; it takes each step with faith.", "mr": "धैर्य हे दाखवण्याचे नसते, ते प्रत्येक पावलात जाणवते."}},
    {"title": {"en": "Pure Nostalgia", "mr": "गोड आठवणी"}, "caption": {"en": "Memories carved softly in the passage of time.", "mr": "काळाच्या ओघात जपून ठेवलेल्या अनमोल आठवणी."}},
    {"title": {"en": "Grace & Dignity", "mr": "संयम आणि प्रतिष्ठा"}, "caption": {"en": "Dignity is a quiet suit worn with poise.", "mr": "संयम आणि प्रतिष्ठा हीच खरी श्रीमंती असते."}},
    {"title": {"en": "The Foundation", "mr": "पाया"}, "caption": {"en": "Building life on the rock of principles and honor.", "mr": "मूल्ये आणि तत्वांवर रचलेला आयुष्याचा भक्कम पाया."}},
    {"title": {"en": "Innocence of Time", "mr": "काळाचा निष्पापपणा"}, "caption": {"en": "A glance back at where it all began.", "mr": "जिथून सगळं सुरू झालं, त्या क्षणांची एक ओझरती झलक."}},

    # 11 - 20: Career, ambition, devotion
    {"title": {"en": "Silent Dedication", "mr": "मूक निष्ठा"}, "caption": {"en": "Working tirelessly with devotion in every hour.", "mr": "प्रत्येक क्षणी निष्ठेने आणि चिकाटीने केलेले कार्य."}},
    {"title": {"en": "The Working Hands", "mr": "कष्टाळू हात"}, "caption": {"en": "Hands that shaped a home and guarded a family.", "mr": "ज्या हातांनी घराला आधार दिला आणि कुटुंबाला सावरले."}},
    {"title": {"en": "Unwavering Focus", "mr": "अढळ लक्ष"}, "caption": {"en": "Clear vision in the midst of daily duties.", "mr": "दैनंदिन जबाबदाऱ्यांमध्येही जपलेली स्पष्ट दृष्टी."}},
    {"title": {"en": "A Man of Word", "mr": "शब्दाचा पक्का"}, "caption": {"en": "Integrity that never needed a contract.", "mr": "ज्याचे बोलणेच विश्वासाचे सर्वात मोठे प्रमाण होते."}},
    {"title": {"en": "Pillar of Strength", "mr": "ताकदीचा आधारस्तंभ"}, "caption": {"en": "The steady rock through every life storm.", "mr": "आयुष्यातील प्रत्येक वादळात स्थिर उभा राहिलेला खडक."}},
    {"title": {"en": "Honest Labor", "mr": "प्रामाणिक कष्ट"}, "caption": {"en": "Pride earned through honest toil and sweat.", "mr": "प्रामाणिक घामाने कमावलेला खरा स्वाभिमान."}},
    {"title": {"en": "Steering the Way", "mr": "दिशा दाखवणारा"}, "caption": {"en": "Always navigating ahead with wisdom.", "mr": "नेहमीच समंजसपणे योग्य मार्ग दाखवणारा मार्गदर्शक."}},
    {"title": {"en": "Resilience", "mr": "लढाऊ वृत्ती"}, "caption": {"en": "Bending with the wind, yet never breaking.", "mr": "वादळात झुकणारा, पण कधीही न मोडणारा स्वभाव."}},
    {"title": {"en": "Devoted Heart", "mr": "समर्पित हृदय"}, "caption": {"en": "Giving everything without asking for anything in return.", "mr": "कोणतीही अपेक्षा न ठेवता फक्त भरभरून देणारे मन."}},
    {"title": {"en": "The Builder", "mr": "घर उभा करणारा"}, "caption": {"en": "Crafting a shelter of love, brick by loving brick.", "mr": "प्रेमाच्या प्रत्येक वीटेने घराचे नंदनवन करणारा."}},

    # 21 - 30: Partnership, marriage, family warmth
    {"title": {"en": "Two Paths United", "mr": "दोन जीवांचे मिलन"}, "caption": {"en": "A beautiful union walking side by side.", "mr": "हातात हात घालून सुरू झालेला एक सुंदर जीवनप्रवास."}},
    {"title": {"en": "Gentle Companionship", "mr": "शांत साथ"}, "caption": {"en": "Understanding each other in the quietest glances.", "mr": "शब्दांशिवाय एकमेकांना समजून घेणारी प्रेमळ साथ."}},
    {"title": {"en": "Warmth of Home", "mr": "घराची उब"}, "caption": {"en": "Home was wherever his warm laughter lived.", "mr": "त्याचे हसू जिथे होते, तिथेच खऱ्या अर्थाने घर होते."}},
    {"title": {"en": "Shared Joy", "mr": "सामायिक आनंद"}, "caption": {"en": "Happiness is twice as sweet when shared together.", "mr": "आनंद जेव्हा वाटून घेतला जातो, तेव्हा तो द्विगुणित होतो."}},
    {"title": {"en": "Enduring Love", "mr": "चिरंतन प्रेम"}, "caption": {"en": "A love that grows richer with every passing season.", "mr": "ऋतू बदलले तरी अधिकच बहरत जाणारे निस्वार्थ प्रेम."}},
    {"title": {"en": "Moments of Peace", "mr": "शांततेचे क्षण"}, "caption": {"en": "Tea, gentle breeze, and the comfort of silence.", "mr": "एक कप चहा, मंद वारा आणि शांततेतली आल्हाददायक सोबत."}},
    {"title": {"en": "The Welcoming Smile", "mr": "प्रेमळ हास्य"}, "caption": {"en": "A smile that welcomed everyone like kin.", "mr": "प्रत्येकाला आपलेसे करून घेणारे अत्यंत प्रेमळ हास्य."}},
    {"title": {"en": "Tender Bond", "mr": "नाजूक बंध"}, "caption": {"en": "Ties woven not by words, but by selfless deeds.", "mr": "शब्दांपेक्षा कृतीतून विणलेली अतूट आणि घट्ट नाती."}},
    {"title": {"en": "Joyful Presence", "mr": "आनंदी सहवास"}, "caption": {"en": "He brought light into every room he entered.", "mr": "त्यांच्या उपस्थितीने प्रत्येक खोली आपोआप उजळून निघायची."}},
    {"title": {"en": "Home & Hearth", "mr": "घर आणि संसार"}, "caption": {"en": "Where love was served on every plate.", "mr": "जिथे प्रत्येक क्षणात आणि घासात प्रेम भरलेले होते."}},

    # 31 - 40: Parenting, children, guidance
    {"title": {"en": "Father's Guidance", "mr": "वडिलांचे मार्गदर्शन"}, "caption": {"en": "Leading not by demand, but by shining example.", "mr": "हुकूम देऊन नाही, तर स्वतःच्या आचरणातून दिशा दाखवणारे."}},
    {"title": {"en": "A Father's Pride", "mr": "वडिलांचा अभिमान"}, "caption": {"en": "Seeing his dreams flourish in his children's eyes.", "mr": "आपल्या मुलांच्या डोळ्यांत स्वतःची स्वप्ने फुलताना पाहणारा."}},
    {"title": {"en": "Gentle Lessons", "mr": "शिकवणी"}, "caption": {"en": "Lessons of kindness taught through daily life.", "mr": "दैनंदिन जीवनातून दिलेली माणुसकीची आणि स्नेहाची शिकवण."}},
    {"title": {"en": "Guardian Angel", "mr": "रक्षक"}, "caption": {"en": "Always standing guard so others could soar.", "mr": "मुलांनी उंचावर झेप घ्यावी म्हणून पाठीशी उभा असलेला आधार."}},
    {"title": {"en": "Warm Embrace", "mr": "उबदार मिठी"}, "caption": {"en": "In his hug, the whole world felt safe.", "mr": "त्यांच्या मिठीत साऱ्या जगाची सुरक्षितता जाणवायची."}},
    {"title": {"en": "Patient Teacher", "mr": "संयमी मार्गदर्शक"}, "caption": {"en": "Patience that listened before speaking.", "mr": "बोलण्याआधी शांतपणे ऐकून घेणारा संयमी स्वभाव."}},
    {"title": {"en": "Laughter Together", "mr": "एकत्र हास्य"}, "caption": {"en": "Laughter echoing across generations.", "mr": "पिढ्यानपिढ्या गुंजणारे मनमोकळे आणि दिलखुलास हास्य."}},
    {"title": {"en": "Shared Milestones", "mr": "यशाचे टप्पे"}, "caption": {"en": "Every triumph celebrated with a grateful heart.", "mr": "प्रत्येक छोट्या-मोठ्या यशाचे कृतज्ञतेने केलेले स्वागत."}},
    {"title": {"en": "Unconditional Love", "mr": "अथांग प्रेम"}, "caption": {"en": "Love that knew no conditions or boundaries.", "mr": "ज्या प्रेमाला ना कसली मर्यादा होती, ना कोणती अट."}},
    {"title": {"en": "The Guiding Beacon", "mr": "दीपस्तंभ"}, "caption": {"en": "A lighthouse in life's rough waters.", "mr": "आयुष्याच्या प्रत्येक वळणावर वाट दाखवणारा दीपस्तंभ."}},

    # 41 - 55: Celebrations, festivals, traditions
    {"title": {"en": "Festival Lights", "mr": "उत्सवाचे तेज"}, "caption": {"en": "Glowing brighter than the festival lamps.", "mr": "दिवाळीच्या दिव्यांपेक्षाही अधिक उजळणारे चेहऱ्यावरचे तेज."}},
    {"title": {"en": "Family Gathering", "mr": "कुटुंब मेळावा"}, "caption": {"en": "Surrounded by the ones who held his heart.", "mr": "आपल्या प्रियजनांच्या गोड गोतावळ्यात घालवलेले क्षण."}},
    {"title": {"en": "Colors of Joy", "mr": "आनंदाचे रंग"}, "caption": {"en": "Drenched in the laughter of celebrations.", "mr": "उत्सवाच्या आणि रंगांच्या उत्साहात न्हाऊन निघालेले मन."}},
    {"title": {"en": "Sacred Traditions", "mr": "पवित्र परंपरा"}, "caption": {"en": "Honoring traditions with a humble bow.", "mr": "परंपरा आणि संस्कृतीचा आदराने जपलेला वारसा."}},
    {"title": {"en": "Festive Cheer", "mr": "सणाचा उत्साह"}, "caption": {"en": "When joy spilled over into every corner.", "mr": "घराच्या कानाकोपऱ्यात भरून राहिलेला सणाचा आनंद."}},
    {"title": {"en": "Wedding Bells", "mr": "मंगल क्षण"}, "caption": {"en": "Tears of joy in moments of celebration.", "mr": "मंगलाष्टकांच्या सुरांमध्ये दाटून आलेले आनंदाश्रू."}},
    {"title": {"en": "The Blessing Hand", "mr": "आशीर्वादाचा हात"}, "caption": {"en": "A palm placed gently upon bowed heads.", "mr": "माथ्यावर प्रेमाने आणि आपुलकीने ठेवलेला आशीर्वादाचा हात."}},
    {"title": {"en": "Feast of Love", "mr": "प्रीतीचे भोजन"}, "caption": {"en": "Meals sweetened by togetherness.", "mr": "एकत्र बसून खाल्लेल्या अन्नाला मिळालेली प्रेमाची गोडी."}},
    {"title": {"en": "Harmony", "mr": "एकता"}, "caption": {"en": "Bringing hearts together in harmony.", "mr": "सर्वांना प्रेमाच्या एका धाग्यात गुंफून ठेवणारी शक्ती."}},
    {"title": {"en": "Golden Days", "mr": "सोनेरी दिवस"}, "caption": {"en": "Moments that shine like timeless gold.", "mr": "काळाच्या कसोटीवर खरे उतरलेले सोन्यासारखे दिवस."}},
    {"title": {"en": "Kinship", "mr": "नातेसंबंध"}, "caption": {"en": "Celebrating the timeless beauty of family.", "mr": "नात्यांमधील जिव्हाळा आणि आपुलकीचा साजरा केलेला सोहळा."}},
    {"title": {"en": "Radiant Smiles", "mr": "तेजस्वी हास्य"}, "caption": {"en": "Smiles that needed no camera to shine.", "mr": "मनातून ओसंडून वाहणारे अस्सल आणि तेजस्वी हास्य."}},
    {"title": {"en": "Warm Welcomes", "mr": "प्रेमळ स्वागत"}, "caption": {"en": "An open door and an open heart.", "mr": "नेहमी उघडी असलेली घराची आणि मनाची कवाडे."}},
    {"title": {"en": "Sweet Memories", "mr": "मधुर आठवणी"}, "caption": {"en": "Sweetness that lingers through the years.", "mr": "वर्षानुवर्षे मनात दरवळणारा आठवणींचा सुगंध."}},
    {"title": {"en": "The Cheerful Host", "mr": "आदरातिथ्य"}, "caption": {"en": "Making everyone feel treasured and seen.", "mr": "घरी आलेल्या प्रत्येकाला सन्मान आणि प्रेम देणारा स्वभाव."}},

    # 56 - 70: Travels, nature, scenic roads, journeys
    {"title": {"en": "The Open Road", "mr": "मोकळी वाट"}, "caption": {"en": "Wandering with an open spirit toward new skies.", "mr": "नव्या आकाशाच्या शोधात मोकळ्या वाटेने निघालेला प्रवासी."}},
    {"title": {"en": "Whispers of Nature", "mr": "निसर्गाचा सहवास"}, "caption": {"en": "Finding divine peace under green canopies.", "mr": "हिरव्यागार निसर्गाच्या कुशीत मिळालेली आत्मिक शांतता."}},
    {"title": {"en": "Mountain Horizons", "mr": "पर्वतरांगा"}, "caption": {"en": "Standing tall where the earth meets the heavens.", "mr": "क्षितिजावर भेटणाऱ्या डोंगरदऱ्यांचे विलोभनीय रूप."}},
    {"title": {"en": "Sacred Journey", "mr": "तीर्थयात्रा"}, "caption": {"en": "Steps walked in reverence and prayer.", "mr": "श्रद्धा आणि भक्तीभावाने टाकलेले प्रत्येक पवित्र पाऊल."}},
    {"title": {"en": "Breeze of the Coast", "mr": "सागरी लाटा"}, "caption": {"en": "Listening to the ocean's timeless songs.", "mr": "समुद्राच्या अथांग लाटांचे संगीत अनुभवताना."}},
    {"title": {"en": "Wandering Soul", "mr": "भटकांती"}, "caption": {"en": "Every new place welcomed with wonder.", "mr": "प्रत्येक नवीन जागेचे कुतूहलाने केलेले स्वागत."}},
    {"title": {"en": "Tranquil Waters", "mr": "शांत जल"}, "caption": {"en": "Reflections of a soul that found peace.", "mr": "शांत पाण्यात उमटलेले समाधानी मनाचे प्रतिबिंब."}},
    {"title": {"en": "Journeying Together", "mr": "एकत्र प्रवास"}, "caption": {"en": "The best journeys are taken with loved ones.", "mr": "सर्वात सुंदर प्रवास तोच, जो आपुलकीच्या माणसांसोबत होतो."}},
    {"title": {"en": "Serenade of Trees", "mr": "वृक्षांची सावली"}, "caption": {"en": "Sheltered by the wisdom of the earth.", "mr": "झाडांच्या थंडगार सावलीत मिळालेली तृप्त विश्रांती."}},
    {"title": {"en": "Roads Less Traveled", "mr": "अनोख्या वाटा"}, "caption": {"en": "Finding treasures off the beaten path.", "mr": "नेहमीच्या वाटा सोडून शोधलेले अनपेक्षित सौंदर्य."}},
    {"title": {"en": "Sunset Hues", "mr": "संध्याकाळचे रंग"}, "caption": {"en": "The sky painted in evening gold.", "mr": "मावळत्या सूर्याच्या सोनेरी रंगात न्हाऊन निघालेले आकाश."}},
    {"title": {"en": "Quiet Sanctuary", "mr": "शांत निवारा"}, "caption": {"en": "A place where the soul could simply breathe.", "mr": "जिथे मन सर्व चिंता विसरून शांत विसावू शकत होते."}},
    {"title": {"en": "Morning Light", "mr": "सकाळचा कोवळा ऊन"}, "caption": {"en": "Welcoming the first golden rays.", "mr": "दिवसाच्या पहिल्या कोवळ्या किरणांचे प्रसन्न स्वागत."}},
    {"title": {"en": "The Traveler", "mr": "सफर"}, "caption": {"en": "Collecting memories instead of things.", "mr": "वस्तूंऐवजी अनमोल क्षणांची केलेली समृद्ध पुंजी."}},
    {"title": {"en": "Endless Vistas", "mr": "विस्तीर्ण क्षितीज"}, "caption": {"en": "Gazing into horizons that stretch forever.", "mr": "दूरवर पसरलेल्या क्षितिजाकडे टक लावून पाहताना."}},

    # 71 - 85: Wisdom, strength, elder grace
    {"title": {"en": "Seasoned Eyes", "mr": "अनुभवी दृष्टी"}, "caption": {"en": "Eyes that have seen the world with kindness.", "mr": "ज्याने जगाकडे नेहमीच दयाळू आणि समंजस नजरेने पाहिले."}},
    {"title": {"en": "Strength in Silence", "mr": "शांत ताकद"}, "caption": {"en": "A quiet heart speaks with majestic volume.", "mr": "शांतता हीच ज्यांच्या व्यक्तिमत्त्वाची खरी ताकद होती."}},
    {"title": {"en": "Contentment", "mr": "समाधान"}, "caption": {"en": "True wealth is knowing you have enough.", "mr": "मनातील समाधान हीच आयुष्यातील सर्वात मोठी संपत्ती."}},
    {"title": {"en": "Elder's Warmth", "mr": "वडिलधाऱ्यांची माया"}, "caption": {"en": "A sheltering tree for all who come near.", "mr": "जवळ येणाऱ्या प्रत्येकाला सावली देणारा महावृक्ष."}},
    {"title": {"en": "Words of Gold", "mr": "मोलाचे बोल"}, "caption": {"en": "Spoken rarely, valued always.", "mr": "कमी बोलणारे, पण बोलतील ते लाख मोलाचे ठरणारे."}},
    {"title": {"en": "Peaceful Stroll", "mr": "शांत फेरफटका"}, "caption": {"en": "Walking with contentment in every step.", "mr": "प्रत्येक पावलावर समाधानाचा अनुभव घेत चालताना."}},
    {"title": {"en": "The Calm Port", "mr": "शांत किनारा"}, "caption": {"en": "A harbor of safety for the next generation.", "mr": "पुढच्या पिढीसाठी सुरक्षित आणि प्रेमळ किनारा."}},
    {"title": {"en": "Simple Pleasures", "mr": "साधे सुख"}, "caption": {"en": "Finding immense joy in modest moments.", "mr": "साध्या साध्या गोष्टींतून मिळणारा अथांग आनंद."}},
    {"title": {"en": "Gentle Spirit", "mr": "निरागस मन"}, "caption": {"en": "Tender-hearted through all life's trials.", "mr": "आयुष्याच्या प्रत्येक परीक्षेत जपलेले निष्पाप आणि निर्मळ मन."}},
    {"title": {"en": "Guiding Star", "mr": "ध्रुव तारा"}, "caption": {"en": "An unchanging reference point of goodness.", "mr": "सद्गुणांचा कधीही न बदलणारा अढळ ध्रुव तारा."}},
    {"title": {"en": "A Life of Honor", "mr": "सन्मानाचे आयुष्य"}, "caption": {"en": "Living without regrets, full of honor.", "mr": "अभिमानाने आणि सन्मानाने जगलेले एक आदर्श आयुष्य."}},
    {"title": {"en": "Golden Years", "mr": "सोनेरी क्षण"}, "caption": {"en": "Evening light shining with rich serenity.", "mr": "आयुष्याच्या सायंकाळी चमकणारे शांत आणि तृप्त तेज."}},
    {"title": {"en": "Treasured Wisdom", "mr": "अनुभवाचे धन"}, "caption": {"en": "Wisdom gifted freely to those who listened.", "mr": "पुढच्या पिढीला प्रेमाने दिलेली अनुभवाची अनमोल शिदोरी."}},
    {"title": {"en": "The Patient Watcher", "mr": "संयमी नजर"}, "caption": {"en": "Observing life with boundless affection.", "mr": "अथांग प्रेमाने आणि मायेने जीवनाकडे पाहणारा."}},
    {"title": {"en": "Graceful Aging", "mr": "सौम्य व्यक्तिमत्त्व"}, "caption": {"en": "Aging like fine poetry, deeper with time.", "mr": "काळासोबत अधिकच समृद्ध आणि अर्थपूर्ण होत गेलेले जीवन."}},

    # 86 - 95 (14 items up to 99): Legacy, love, timeless memories
    {"title": {"en": "Endless Gratitude", "mr": "अनंत कृतज्ञता"}, "caption": {"en": "For every sacrifice made in silence.", "mr": "मुक्याने केलेल्या प्रत्येक त्यागासाठी मनापासून कृतज्ञता."}},
    {"title": {"en": "Generations Together", "mr": "पिढ्यांचे नाते"}, "caption": {"en": "The bridge connecting yesterday and tomorrow.", "mr": "भूतकाळ आणि भविष्यकाळाला जोडणारा एक भक्कम सेतू."}},
    {"title": {"en": "A Heart of Gold", "mr": "सोन्याचे हृदय"}, "caption": {"en": "A heart that gave and never asked.", "mr": "फक्त द्यायला शिकलेले, कधीही न मागितलेले सोन्याचे मन."}},
    {"title": {"en": "Cherished Presence", "mr": "अनमोल सहवास"}, "caption": {"en": "Every second in his presence was a blessing.", "mr": "त्यांच्या सहवासातला प्रत्येक क्षण हा ईश्वरी आशीर्वाद होता."}},
    {"title": {"en": "Everlasting Smile", "mr": "अविस्मरणीय हसू"}, "caption": {"en": "A smile that stays in our hearts forever.", "mr": "आपल्या हृदयात कायमचे घर करून राहिलेले मनमोहक हास्य."}},
    {"title": {"en": "Footprints of Kindness", "mr": "मायेची पाऊलवाट"}, "caption": {"en": "Leaving footprints of kindness and joy everywhere he goes.", "mr": "जिथे जातात तिथे प्रेमाची आणि आनंदाची पाऊलवाट निर्माण करणारे."}},
    {"title": {"en": "50 Years of Wisdom", "mr": "५० वर्षांची समृद्ध वाटचाल"}, "caption": {"en": "Your values and guidance inspire us each and every day.", "mr": "तुमचे विचार आणि संस्कार आम्हा सर्वांना प्रत्येक क्षणी नवी प्रेरणा देतात."}},
    {"title": {"en": "Unbreakable Bond", "mr": "अतूट नाते"}, "caption": {"en": "A lifelong bond of love and respect that grows stronger every day.", "mr": "काळासोबत अधिकच घट्ट आणि समृद्ध होत जाणारे प्रेमाचे अतूट नाते."}},
    {"title": {"en": "Everlasting Warmth", "mr": "चिरंतन उब"}, "caption": {"en": "The warmth of your love continues to guide and protect our family.", "mr": "तुमच्या प्रेमाची आणि आशीर्वादाची सावली आमच्या पाठीशी सदैव खंबीर उभी आहे."}},
    {"title": {"en": "The Unsung Hero", "mr": "खरा हिरो"}, "caption": {"en": "Our hero without a cape, our father.", "mr": "कोणताही बडेजाव न मिरवणारा आमचा खरा हिरो—आमचे बाबा."}},
    {"title": {"en": "Guiding Light", "mr": "मार्गदर्शक तारा"}, "caption": {"en": "Lighting the way even in the darkest night.", "mr": "काळोखातही आम्हाला योग्य मार्ग दाखवणारा प्रकाश."}},
    {"title": {"en": "Golden Milestone", "mr": "सुवर्ण महोत्सवी क्षण"}, "caption": {"en": "Celebrating 50 magnificent years filled with courage, love, and laughter.", "mr": "प्रेम, त्याग आणि हास्याने परिपूर्ण ५० सुवर्ण वर्षांचा गौरवशाली सोहळा!"}},
    {"title": {"en": "Cheers to 50!", "mr": "५० वर्षांचा गौरव"}, "caption": {"en": "Honoring fifty glorious years and looking forward to many more joyful decades together!", "mr": "५० वर्षांच्या यशस्वी जीवनप्रवासाचा आनंदोत्सव आणि पुढील सुखद प्रवासासाठी मनःपूर्वक शुभेच्छा!"}},
    {"title": {"en": "The Golden Journey Continues", "mr": "सुवर्ण जीवनगाथा"}, "caption": {"en": "50 wonderful chapters celebrated, and the happiest years still ahead!", "mr": "५० वर्षांची ही सुंदर जीवनगाथा साजरी करताना, पुढील प्रत्येक वर्षासाठी अनंत शुभेच्छा!"}}
]

def generate_slide_config(img_filename, index, center_x, exif_year):
    slide_id = f"slide-{index}"
    stem = Path(img_filename).stem

    # Determine layout
    if center_x < 0.46:
        text_pos = "right"
        cutout_pos = "left"
    elif center_x > 0.54:
        text_pos = "left"
        cutout_pos = "right"
    else:
        text_pos = "left" if (index % 2 == 1) else "right"
        cutout_pos = "right" if (index % 2 == 1) else "left"

    # Select story title/caption
    data_idx = (index - 1) % len(STORY_DATA)
    story = STORY_DATA[data_idx]

    # Year estimation
    if exif_year:
        year_val = str(exif_year)
    else:
        # Interpolate year across timeline (e.g. 2010 to 2026)
        approx = 2010 + int(((index - 1) / 98) * 16)
        year_val = str(approx)

    return {
        "id": slide_id,
        "backgroundImage": f"{stem}.jpg",
        "cutoutImage": f"{stem}_cutout.png",
        "title": story["title"],
        "caption": story["caption"],
        "year": year_val,
        "textPosition": text_pos,
        "cutoutPosition": cutout_pos,
        "cutoutScale": 1.0,
        "parallaxIntensity": 1.6
    }

def main():
    print("🚀 Starting comprehensive image processing...")
    sorted_files = get_sorted_images()
    print(f"📁 Found {len(sorted_files)} images in img_Dir")

    if not MODEL_PATH.exists():
        print(f"❌ Model missing at {MODEL_PATH}")
        sys.exit(1)

    print("🤖 Loading RMBG-1.4 model...")
    sess_opts = ort.SessionOptions()
    sess_opts.intra_op_num_threads = 0
    sess_opts.inter_op_num_threads = 0
    session = ort.InferenceSession(str(MODEL_PATH), sess_options=sess_opts, providers=['CPUExecutionProvider'])
    print("✅ Model loaded successfully\n")

    # Step 1: Clean out old files
    for f in ORIG_OUT.glob("*"):
        f.unlink(missing_ok=True)
    for f in CUT_OUT.glob("*"):
        f.unlink(missing_ok=True)
    print("🧹 Cleared old originals and cutouts.\n")

    # Step 2: Process 0.jpg (Intro & Outro Background)
    if "0.jpg" in sorted_files:
        print("🖼️ Processing 0.jpg (Intro & Outro background)...")
        p0 = IMG_DIR / "0.jpg"
        center_x_0 = process_image(p0, session)
        print("   ✅ 0.jpg processed and saved to originals & cutouts.")

    # Step 3: Process Slides (1.JPG through 95.jpg)
    slide_files = [f for f in sorted_files if f != "0.jpg"]
    print(f"\n📸 Processing {len(slide_files)} slide images...")

    slides_config = []
    for idx, filename in enumerate(tqdm(slide_files, desc="Generating cutouts & slides", unit="img"), start=1):
        src_path = IMG_DIR / filename
        center_x = process_image(src_path, session)
        year = get_exif_year(src_path)
        slide_cfg = generate_slide_config(filename, idx, center_x, year)
        slides_config.append(slide_cfg)

    # Step 4: Load existing config to preserve site & music settings
    existing_cfg = {}
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                existing_cfg = json.load(f)
        except Exception:
            pass

    # Build updated config
    updated_config = {
        "site": existing_cfg.get("site", {
            "title": {"en": "Amol Patil", "mr": "अमोल पाटील"},
            "subtitle": {"en": "A Life Full of Love", "mr": "प्रेमाने भरलेलं आयुष्य"},
            "defaultLanguage": "en",
            "font": "Cormorant Garamond",
            "accentColor": "#c9a96e",
            "bgColor": "#080808"
        }),
        "ui": {
            "autoScrollSeconds": 10,
            "showProgressBar": True,
            "showSlideCounter": True,
            "showScrollHint": True
        },
        "intro": {
            "heading": {"en": "Celebrating 50 Years of", "mr": "५० व्या वाढदिवसाच्या निमित्ताने —"},
            "name": {"en": "Amol Patil", "mr": "अमोल पाटील"},
            "tagline": {"en": "Scroll to explore 50 golden years →", "mr": "५० वर्षांचा हा सुंदर जीवनप्रवास अनुभवण्यासाठी स्क्रोल करा →"},
            "backgroundImage": "0.jpg"
        },
        "music": existing_cfg.get("music", {
            "enabled": True,
            "defaultMuted": False,
            "loop": True,
            "tracks": [
                {
                    "id": "track-1",
                    "title": "Lambiyan",
                    "file": "music/Raataan_Lambiyan_Instru.mp3"
                }
            ],
            "defaultTrack": "track-1"
        }),
        "slides": slides_config,
        "outro": {
            "heading": {"en": "With Love", "mr": "प्रेमाने"},
            "message": {"en": "Thank you for every moment, every smile, and your endless love.", "mr": "प्रत्येक क्षणासाठी, प्रत्येक हास्यासाठी आणि तुमच्या अथांग प्रेमासाठी आम्ही सदैव ऋणी आहोत."},
            "backgroundImage": "0.jpg"
        }
    }

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(updated_config, f, indent=2, ensure_ascii=False)

    print("\n✅ Successfully updated config.json with all 99 slides!")
    print(f"📁 Originals: {len(list(ORIG_OUT.glob('*')))} files")
    print(f"✂️  Cutouts:   {len(list(CUT_OUT.glob('*')))} files")

if __name__ == "__main__":
    main()
