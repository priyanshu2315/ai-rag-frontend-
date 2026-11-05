-1st slide 

Good morning vayuzers 
I am priyanshu from node x 


-2nd slide 
today i am going to showcase my horcrux suggestion for social 

-3rd slide 

but first lets talk about journey of finding my horcrux 

-4th slide

its RAG

-5th slide 

so lets understand RAG by an example first 

imagine you go to a restaurant and order shahi paneer

-6th slide

so behind the scenes we have a chef who knows the recipe and he knows all the ingredients 

and these ingredients are on different shelves of different cupboards

he combines all these ingredients, and his magic and creates our shahi paneer


-7th slide (pending create this slide)


here in our example shahi paneer is our query, chef is our LLM model, recipe is LLMs knowledge, pantry is our database, cupboards are documents, shelfs are the chunks, and lastly ingredients are the particular text extract that we need from that chunk

so our chef or LLM model combines it all and serves us our tasty response 


-8th slide

this was the same old basic and common rag you know 

-9th slide
 
or should i say this was the RAG you ALL know, aajkal har koi rag padh hi raha


-10th slide 

but in RAG there are lot of things I saw that you guys probably dont know 

-11th slide 

LOT of things for example 
in rag there are two pipelines ingestion and search, and they both depend on each other, you have worked and worked and optimized the search to next level but if you data is not stored correclty this optimization don't work or vise vera app data ko bhot ache se store krre ho but apka search optimized nhai h so you don't the result you want.

Initially mujhe laga search ko optimize karte jao and results better ho jayenge,But then I realised ki dono completely dependent hain, 
 
Aap Hybrid Search, RRF, Cross-Encoder, CRAG sab laga do... but agar ingestion ke time 
Table header alag chunk mein chala gaya
Row apne column label se separate ho gayi
Heading galat attach ho gayi
Heading hierarchy collapse ho gayi
Page break ne context tod diya
TOC ko actual content samajh liya
Cross-reference detect nahi hua
Scanned image ka text extract nahi hua
OCR ne numbers galat read kar diye
Document reading order corrupt ho gaya
Chunk bahut bada hua → semantic dilution
Chunk bahut chhota hua → context fragmentation
Neighboring context link missing ho gaya
Section breadcrumb wrong store ho gaya
Page number / source metadata incorrect ho gaya
Outdated value aur latest value distinguish nahi hui
Amendment / restatement original value se link nahi hua
Table continuation next page par detect nahi hui


Even agar ingestion perfect hai, search pipeline phir bhi fail ho sakti hai agar:

User ki query vague ho
Query mein “ye”, “wo”, “iska”, “uska” ho aur context resolve na ho
Follow-up question previous conversation ka context lose kar de
Exact keyword semantic search mein miss ho jaye
IDs / codes / part numbers vector search mein correctly match na ho
Keyword search text dhoondh le but actual meaning miss kar de
Vector search meaning dhoondh le but exact term miss kar de
Hybrid search bahut noisy candidates le aaye
Relevant chunk mil jaye but top rank par na aaye
RRF wrong result ko zyada priority de de
Cross-Encoder wrong chunk ko upar push kar de
Candidate pool bahut chhota ho → relevant result miss
Candidate pool bahut bada ho → latency + noise
Query decomposition question ko galat parts mein tod de
Multiple questions ko ek hi query treat kar diya jaye
Multi-hop query first hop ke baad ruk jaye
Second-hop search pehle mile fact ko use hi na kare
Query rewriting sirf wording change kare, search ko aage na badhaye
Search loop baar-baar retry karta rahe
Cross-reference expansion irrelevant sections fetch kar le
Neighbor expansion unnecessary context kheench laaye
Section expansion poora irrelevant section utha le
Table expansion wrong rows ya incomplete context le aaye
Context window overload ho jaye
Token budget TPM / context limit cross kar de
Bahut zyada evidence answer ko confuse kar de
Bahut kam evidence hallucination karwa de
Retrieval confidence correctly estimate na ho
0 results ke baad agent unnecessary searches karta rahe
Page-specific query vector search ko bhej di jaye
ANN index na ho aur full vector scan chale
Search quality improve ho but response time unacceptable ho
Search fast ho but eval parameter drop ho jaye
Correct evidence aaye but citation wrong source pe point kare





i know its complicated, bhot sari chize a rahi h, complicated chizo ka soluiton lana mera kam h apka kam h use cases lana


.......

social rag

rag social m kese contribute kr sakt h, so lets start with a small part, sop's jo daily use krte h, it basic use of  rag here 








----------
how is priyanshu and who he report to and who is the lead of that lead
what is rh leave policy?
i cannot attend saturday call, how to inform
when should i take leave so it become long weekend
