#!/usr/bin/bash
#
# Updates html files with cache busting urls including file hashes.

# Setup colors
# Reset
Color_Off='\033[0m'       # Text Reset

# Regular Colors
Black='\033[0;30m'        # Black
Red='\033[0;31m'          # Red
Green='\033[0;32m'        # Green
Yellow='\033[0;33m'       # Yellow
Blue='\033[0;34m'         # Blue
Purple='\033[0;35m'       # Purple
Cyan='\033[0;36m'         # Cyan
White='\033[0;37m'        # White

# Bold
BBlack='\033[1;30m'       # Black
BRed='\033[1;31m'         # Red
BGreen='\033[1;32m'       # Green
BYellow='\033[1;33m'      # Yellow
BBlue='\033[1;34m'        # Blue
BPurple='\033[1;35m'      # Purple
BCyan='\033[1;36m'        # Cyan
BWhite='\033[1;37m'       # White

# Underline
UBlack='\033[4;30m'       # Black
URed='\033[4;31m'         # Red
UGreen='\033[4;32m'       # Green
UYellow='\033[4;33m'      # Yellow
UBlue='\033[4;34m'        # Blue
UPurple='\033[4;35m'      # Purple
UCyan='\033[4;36m'        # Cyan
UWhite='\033[4;37m'       # White

# Background
On_Black='\033[40m'       # Black
On_Red='\033[41m'         # Red
On_Green='\033[42m'       # Green
On_Yellow='\033[43m'      # Yellow
On_Blue='\033[44m'        # Blue
On_Purple='\033[45m'      # Purple
On_Cyan='\033[46m'        # Cyan
On_White='\033[47m'       # White

# High Intensity
IBlack='\033[0;90m'       # Black
IRed='\033[0;91m'         # Red
IGreen='\033[0;92m'       # Green
IYellow='\033[0;93m'      # Yellow
IBlue='\033[0;94m'        # Blue
IPurple='\033[0;95m'      # Purple
ICyan='\033[0;96m'        # Cyan
IWhite='\033[0;97m'       # White

# Bold High Intensity
BIBlack='\033[1;90m'      # Black
BIRed='\033[1;91m'        # Red
BIGreen='\033[1;92m'      # Green
BIYellow='\033[1;93m'     # Yellow
BIBlue='\033[1;94m'       # Blue
BIPurple='\033[1;95m'     # Purple
BICyan='\033[1;96m'       # Cyan
BIWhite='\033[1;97m'      # White

# High Intensity backgrounds
On_IBlack='\033[0;100m'   # Black
On_IRed='\033[0;101m'     # Red
On_IGreen='\033[0;102m'   # Green
On_IYellow='\033[0;103m'  # Yellow
On_IBlue='\033[0;104m'    # Blue
On_IPurple='\033[0;105m'  # Purple
On_ICyan='\033[0;106m'    # Cyan
On_IWhite='\033[0;107m'   # White

# Check requirements
if ! which echo > /dev/null
then
    exit -1
fi

required_programs=(find grep cut sed sha1sum)

for program in $required_programs
do
    if ! which $program > /dev/null
    then
        echo -e "${Red}[error] Requires '$program' command to be installed${Color_Off}"
        exit -1
    fi
done

# Actual file processing
for htmlfile in $(find -type f -name \*.html -not -path "./node_modules/*")
do
    echo -e "${BIBlue}[info] Processing '${htmlfile}' for cache busting...${Color_Off}"
    
    LIST=$(find -type f -regex '.*\.css\|.*\.js' -not -path "./node_modules/*" | sed 's/\.\///g')

    if [ "$1" = "gitadd" ]
    then
        LIST=$(git status -s | grep -oE "[A-Z]  .+" | cut -d" " -f3)
    fi

    for resourcefile in $LIST
    do
        # Check if resource is used in html file
        resourceusage=$(grep -i "$resourcefile" "$htmlfile")
        if [ $? -eq 0 ]
        then
            # This is just for cache busting...
            # If 7 first characters of SHA1 is okay for git, it should be more than enough for us
            hash="$(sha1sum $resourcefile | cut -d' ' -f1 | head -c 7)"
            
            # Check if resource hash is already correct
            if ! echo "$resourceusage" | grep -i "=$hash\"" > /dev/null
            then
                escaped=$(echo $resourcefile | sed 's/\//\\\//g' | sed 's/\./\\./g')
                sed -Ei "s/${escaped}(\?v=[a-z0-9]+)?/${escaped}?v=${hash}/g" "$htmlfile"
                
                echo -e "${BIBlue}[info]${Color_Off} Updated resource ${resourcefile} to hash ${hash}"
            fi
        fi
    done
done